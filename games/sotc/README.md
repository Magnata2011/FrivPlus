# Shadow of the Colossus (Web)

Port web via ps2-web-recomp. Sirva com:

```
python3 /tmp/ps2-web-recomp/scripts/serve.py . disc.iso 8620
```

Abra http://127.0.0.1:8620/

O disco (`disc.iso`) aponta para `Shadow of the Colossus (U)/Shadow of the Colossus.ISO`.
Para deploy, substitua o symlink por um arquivo real ou URL no Vercel Blob e ajuste `?disc=`.
