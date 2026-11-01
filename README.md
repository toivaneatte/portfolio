# Portfoliosivu

Staattinen, kaksikielinen (fi/en) sivu. Pyörii kotiserverillä nginx-kontissa,
joka kuuntelee vain osoitetta 127.0.0.1:8085. Cloudflare Tunnel julkaisee sen
internetiin ilman avattuja portteja.

- `site/` – sivu (index.html, style.css, app.js, fontit). Muokkaa tekstejä index.html:ssä:
  jokaisella tekstillä on suomenkielinen `lang="fi"` ja englanninkielinen `lang="en"` versio.
- `nginx.conf` – tietoturvaotsakkeet, vain GET/HEAD-pyynnöt
- `portfolio-status.sh` + `systemd/` – kirjoittaa sivulle palvelimen käyntiajan ja
  viimeisimmän onnistuneen varmuuskopion (status.json) viiden minuutin välein

Muutokset sivuun näkyvät heti tallennuksen jälkeen, konttia ei tarvitse käynnistää uudelleen.
Cloudflare voi välimuistittaa tiedostoja hetken: tyhjennä tarvittaessa
Cloudflaren hallinnasta (Caching → Purge Everything).
