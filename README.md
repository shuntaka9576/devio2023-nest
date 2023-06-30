# サンプルアプリ

## 公開
一通りできたら、リポジトリを作成して過去コミット消去する

## アプリの内容

エンジニアに馴染みの深い技術投稿サイトのサーバサイドをイメージして、作成しています。以下号了承ください。

* 登壇で説明したいTipsを解説する目的で作成されているので不完全な場合があります

## 機能

* パブリックな技術記事取得クエリ
* 自分の技術記事取得クエリ
* プロフィール取得クエリ

## 構築方法

```bash
export DEV_AWS_ACCOUNT_ID=""
export ITG_AWS_ACCOUNT_ID=""
export PRD_AWS_ACCOUNT_ID=""

npx cdk deploy -c stageName=dev dev-devio2023-network
npx cdk deploy -c stageName=dev dev-devio2023-backend
npx cdk deploy -c stageName=dev dev-devio2023-backend-ecr
```

## 注意点

* CDKのRemovalPolicyは試行錯誤しやすいようにDESTROYになっています。状況に応じて調整してください。

## コンテナ作成

### コンテナビルド

```bash
export IMAGE_NAME=devio2023-web-api
export AWS_ACCOUNT_ID=
export REGISTORY_NAME=$AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
export COMMITHASH=$(git rev-parse --short HEAD)

// コンテナイメージの作成
docker build -t $IMAGE_NAME -f web-api/Dockerfile .
docker tag $IMAGE_NAME \
  $REGISTORY_NAME/$IMAGE_NAME:$COMMITHASH

# assume-roleが必要
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
docker push "$AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/$IMAGE_NAME:$COMMITHASH"
```

## データベース

### データベース作成

```bash
export USER_NAME="root"
export PASSWORD=""
export MYSQL_ENDPOINT="127.0.0.1"
export MYSQL_PORT="3306"
export DB_DBNAME="devio2023db"
export DATABASE_URL="mysql://$USER_NAME:@$MYSQL_ENDPOINT:$MYSQL_PORT/$DB_DBNAME"

# スキーマ作成
npx prisma migrate dev
# データ投入
npx zx --quiet ./bin/init-data.mjs
```

relationバージョンの場合、上記のコマンドの以下の変数を変更する
```bash
export DB_DBNAME="devio2023db_r"
npx prisma migrate dev --schema schema-relation.prisma
```

### データベース起動

**初回コンテナ起動時は、mysqld.cnf の`autocommit=1`に設定した上で実行する。**

```bash
docker compose up -d

# 起動できない場合、以下のコマンドを実行した上で、初回コンテナ起動する
# docker compose down --rmi all --volumes --remove-orphans
```

## アプリケーションの起動

```bash
export LINE_CHANNEL_ID=""
npx dotenv -e ./.env.dev -- nest start --watch
```

relationバージョンの場合、上記のコマンドの以下の変数を変更する
```bash
export DB_DBNAME="devio2023db_r"

npx dotenv -e ./.env.dev -- nest start --watch
```


## クエリ

### 共通

ベアラートークンを設定
```bash
export BEARER_TOKEN=""
```

### session情報

```bash
curl 'http://localhost:3001/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Origin: http://localhost:3001' \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  --data-binary '{"query":"query {\n  sessions {\n    nodes {\n      id\n      title\n      speakers {\n        id\n        name\n      }\n      date\n      start\n      end\n    }\n  }\n}"}' --compressed | \
  jq
```

```bash
curl 'http://localhost:3001/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Origin: http://localhost:3001' \
  -H "Authorization: Bearer $BEARER_TOKEN" \
  --data-binary '{"query":"query a2 {\n  sessions(filter: {speakerName: \"speakerName1\"}) {\n    nodes {\n      id\n      title\n      speakers {\n        id\n        name\n      }\n      date\n      start\n      end\n    }\n  }\n}"}' --compressed | \
  jq
```

### health-check

```
curl -v GET 'http://localhost:3001/health-check'
```


## 検証内容

[Prismaの各実装と実際に発行されるSQLを確認してみる](https://zenn.dev/shuntaka/scraps/839f1936200006)
