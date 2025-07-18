
// paysteam/server.cjs
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

// Middleware per validazione API key (fittizia)
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'ferrovie-key') {
    return res.status(403).json({ error: 'API key non valida' });
  }
  next();
});

// Endpoint principale per iniziare pagamento
app.post('/api/pay', async (req, res) => {
  const {
    url_risposta,
    id_transazione
  } = req.body;

  console.log('📨 Richiesta pagamento ricevuta per transazione:', id_transazione);
  res.json({ message: 'Pagamento in elaborazione...' });

  // Simulazione asincrona dell'esito dopo 2 secondi
  setTimeout(async () => {
    try {
      const esito = 'OK'; // oppure genera casualmente tra 'OK' e 'KO'
      const notifyRes = await fetch(url_risposta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idTransazione: id_transazione,
          esito
        })
      });

      console.log(`✅ Esito '${esito}' notificato per transazione ${id_transazione}`);
    } catch (err) {
      console.error('❌ Errore durante la notifica a callback:', err.message);
    }
  }, 2000);
});

app.listen(4000, () => {
  console.log('🚀 PaySteam attivo su http://localhost:4000');
});
