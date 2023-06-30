const MYSQL_ENDPOINT = process.env.MYSQL_ENDPOINT;
const MYSQL_PORT = process.env.MYSQL_PORT;
const USER_NAME = process.env.USER_NAME;
const PASSWORD = process.env.PASSWORD;
const DB_DBNAME = process.env.DB_DBNAME;

const main = async () => {
  const initResult = await $`mysql -u \
  ${USER_NAME} \
  -p${PASSWORD} \
  -h ${MYSQL_ENDPOINT} \
  -P ${MYSQL_PORT} \
  -N \
  --local_infile=1 \
  -D  ${DB_DBNAME}\
  -e "source ./data/sql/init-data.sql"`;

  console.log(`--- init result ---
${initResult.stdout}`);
};

main();
