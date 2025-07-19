
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

/* ------------ conferma / annulla ---------------------- */
app.post('/pay/confirm', async (req, res) => {
  const { callback_url, id_transazione, ok } = req.body;

  try {
    await fetch(callback_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urlInviante: `http://localhost:${PORT}`,
        idTransazione: id_transazione,
        esito: ok === '1' ? 'OK' : 'KO'
      })
    });
    res.send(`<h2>Transazione ${ok === '1' ? 'Completata' : 'Annullata'}</h2>
              <a href="/">Torna alla home</a>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore chiamata callback merchant');
  }
});

app.listen(PORT, () => console.log('PaySteam in ascolto sulla porta', PORT));
