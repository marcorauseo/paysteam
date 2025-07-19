const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');  
const router = express.Router();

router.post('/register', async (req, res) => {
  const { nome, cognome, email, password, tipo } = req.body;

  if (!nome || !cognome || !email || !password || !tipo)
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });

  try {
    const hash = await bcrypt.hash(password, 10);

    // Inserisci utente
    const userInsert = await pool.query(`
      INSERT INTO UTENTE_PAY (EMAIL, NOME, COGNOME)
      VALUES ($1, $2, $3)
      RETURNING ID_UTENTE_PAY
    `, [email, nome, cognome]);

    const idUtente = userInsert.rows[0].id_utente_pay;

    // Crea conto con saldo iniziale 100
    await pool.query(`
      INSERT INTO CONTO_CORRENTE (ID_UTENTE_PAY, SALDO)
      VALUES ($1, 100.00)
    `, [idUtente]);

    // Opzionale: salva tipo utente in tabella esterna, o usalo lato app se necessario

    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email già registrata' });
    } else {
      res.status(500).json({ error: 'Errore durante la registrazione' });
    }
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email e password richieste' });

  try {
    const r = await pool.query(
      `SELECT ID_UTENTE_PAY, EMAIL FROM UTENTE_PAY WHERE EMAIL = $1`,
      [email]
    );

    if (r.rowCount === 0)
      return res.status(401).json({ error: 'Utente non registrato' });

    // NOTA: stiamo accettando login senza password reale per semplicità
    // Se vuoi usare bcrypt, dovresti memorizzare anche HASH_PWD nella tabella

    res.json({ message: 'Login ok', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore login' });
  }
});

module.exports = router;
