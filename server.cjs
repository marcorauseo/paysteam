require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// API per scalare saldo
app.post('/api/scalasaldo', async (req, res) => {
  const { email, importo } = req.body;
  if (!email || !importo)
    return res.status(400).json({ error: 'Dati mancanti' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r1 = await client.query(
      `SELECT CC.ID_CONTO, SALDO
       FROM CONTO_CORRENTE CC
       JOIN UTENTE_PAY U ON U.ID_UTENTE_PAY = CC.ID_UTENTE_PAY
       WHERE U.EMAIL = $1 FOR UPDATE`,
      [email]
    );

    if (r1.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const saldo = parseFloat(r1.rows[0].saldo);
    if (saldo < importo) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insufficiente' });
    }

    await client.query(
      'UPDATE CONTO_CORRENTE SET SALDO = SALDO - $1 WHERE ID_CONTO = $2',
      [importo, r1.rows[0].id_conto]
    );

    await client.query('COMMIT');
    res.json({ message: 'Saldo aggiornato' });

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
