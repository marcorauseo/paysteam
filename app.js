
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const cors = require('cors');



app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

/* ------------ pagina di avvio pagamento --------------- */
app.get('/pay', (req, res) => {
  // parametri richiesti
  const { merchant_url, callback_url, id_esercente,
          id_transazione, descrizione, prezzo } = req.query;

  if (!merchant_url || !callback_url || !id_esercente || !id_transazione) {
    return res.status(400).send('Parametri mancanti');
  }

  // serve la pagina di conferma passando i parametri via template string
  res.sendFile(path.join(__dirname, 'confirm.html'));
});

// ✅ Route POST /pay/confirm modificata per mostrare messaggio statico
app.post('/pay/confirm', async (req, res) => {
  const { ok, callback_url, id_transazione } = req.body;
  const stato = ok === '1' ? 'Completato' : 'Annullato';

  // Notifica al backend di train-app se confermato
  if (ok === '1' && callback_url) {
    try {
      await fetch(callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idTransazione: id_transazione,
          esito: 'OK'
        })
      });
      console.log("✅ Callback a train-app inviata con successo");
    } catch (err) {
      console.error("❌ Errore durante la callback a train-app:", err);
    }
  }

  const messaggio = `
    <h2>Transazione ${stato}</h2>
    <p>Pagamento avvenuto con successo.</p>
    <p><a href="https://train-app.onrender.com/dashboard.html">Ritorna al sito dell'esercente</a></p>
  `;
  res.send(messaggio);
});

app.listen(PORT, () => console.log('PaySteam in ascolto sulla porta', PORT));
