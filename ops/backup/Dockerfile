# Container de backup diário — mesma major do banco pra garantir compat de pg_dump.
FROM postgres:16-alpine

RUN apk add --no-cache tzdata coreutils bash

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
