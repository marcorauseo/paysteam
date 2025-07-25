require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const authRoutes = require('./backend/routes/auth');


const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL || process.env.DATABASE_URL,
    ssl: {
    rejectUnauthorized: false,
  },
  
});

// API per verificare saldo
app.get('/api/saldo', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email mancante' });

  try {
    const r = await pool.query(
      `SELECT SALDO FROM CONTO_CORRENTE CC
       JOIN UTENTE_PAY U ON U.ID_UTENTE_PAY = CC.ID_UTENTE_PAY
       WHERE U.EMAIL = $1`,
      [email]
    );
    if (r.rowCount === 0)
      return res.status(404).json({ error: 'Utente non trovato' });

    res.json({ saldo: r.rows[0].saldo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore saldo' });
  }
});


// API per scalare saldo + salvare movimento
app.post('/api/scalasaldo', async (req, res) => {
  const { email, importo } = req.body;
  if (!email || !importo)
    return res.status(400).json({ error: 'Dati mancanti' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Recupera conto e utente
    const r1 = await client.query(
      `SELECT CC.ID_CONTO, CC.ID_UTENTE_PAY, SALDO
       FROM CONTO_CORRENTE CC
       JOIN UTENTE_PAY U ON U.ID_UTENTE_PAY = CC.ID_UTENTE_PAY
       WHERE U.EMAIL = $1 FOR UPDATE`,
      [email]
    );

    if (r1.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const { saldo, id_conto, id_utente_pay } = r1.rows[0];
    if (parseFloat(saldo) < parseFloat(importo)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insufficiente' });
    }

    // Aggiorna saldo
    await client.query(
      'UPDATE CONTO_CORRENTE SET SALDO = SALDO - $1 WHERE ID_CONTO = $2',
      [importo, id_conto]
    );

    // Salva movimento
    await client.query(
      `INSERT INTO MOVIMENTO (ID_UTENTE_PAY, TIPO, IMPORTO, DESCRIZIONE)
       VALUES ($1, 'USCITA', $2, $3)`,
      [id_utente_pay, importo, 'Pagamento acquisto']
    );

    await client.query('COMMIT');
    res.json({ message: 'Saldo aggiornato e movimento registrato' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Errore aggiornamento saldo' });
  } finally {
    client.release();
  }
});


// API per ricevere richiesta pagamento (da app treni)
app.post('/api/pay', async (req, res) => {
  const {
    url_risposta,
    id_transazione,
    descrizione,
    prezzo,
    email_utente
  } = req.body;

  if (!email_utente)
    return res.status(400).json({ error: 'Email utente mancante' });

  const query = new URLSearchParams({
    id: id_transazione,
    callback: url_risposta,
    desc: descrizione,
    prezzo: prezzo,
    email: email_utente
  });

  const redirectUrl = '/checkout.html?' + query.toString();
  res.json({ redirect: redirectUrl });
});

app.listen(4000, () => {
  console.log('✅ PaySteam attivo su http://localhost:4000');
});

app.get('/api/movimenti', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email mancante' });

  try {
    const r = await pool.query(`
      SELECT TIPO, IMPORTO, TO_CHAR(DATA, 'YYYY-MM-DD HH24:MI') as data, DESCRIZIONE
      FROM MOVIMENTO
      WHERE ID_UTENTE_PAY = (
        SELECT ID_UTENTE_PAY FROM UTENTE_PAY WHERE EMAIL = $1
      )
      ORDER BY DATA DESC
    `, [email]);

    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore recupero movimenti' });
  }
});

