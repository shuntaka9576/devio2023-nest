# devio2023-nest

## はじめに

本ソースコードは、devio2023の[「NestJS x Prisma on Fargate構成で作るWeb API開発Tips」](https://speakerdeck.com/shuntaka/devio2023-nestjs-prisma-on-fargate-tips)のサンプルソースコードです。

## インフラ構築手順

```bash
export DEV_AWS_ACCOUNT_ID=""
export ITG_AWS_ACCOUNT_ID=""
export PRD_AWS_ACCOUNT_ID=""

npx cdk deploy -c stageName=dev dev-devio2023-network
npx cdk deploy -c stageName=dev dev-devio2023-backend
npx cdk deploy -c stageName=dev dev-devio2023-backend-ecr
```

補足
* CDKのRemovalPolicyは試行錯誤しやすいようにDESTROYになっています。状況に応じて調整してください。

## コンテナ作成手順

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

#### Relations機能を使わない場合

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

#### Relations機能を使う場合

前項のコマンドの対応コマンドを以下のように変更

```diff
-export DB_DBNAME="devio2023db"
+export DB_DBNAME="devio2023db_r"

-npx prisma migrate dev
+npx prisma migrate dev --schema schema-relation.prisma
```

補足
* Relations機能を使う場合、外部キー制約が作成されるためマイグレーションファイルに差分ができます

### DBコンテナの起動

**初回コンテナ起動時は、mysqld.cnf の`autocommit=1`に設定した上で実行する。**

```bash
docker compose up -d

# 起動できない場合、以下のコマンドを実行した上で、初回コンテナ起動する
# docker compose down --rmi all --volumes --remove-orphans
```

## アプリケーションの起動手順

### Relations機能を使わない場合

```bash
export LINE_CHANNEL_ID=""
npx dotenv -e ./.env.dev -- nest start --watch
```

### Relations機能を使わない場合

前項のコマンドに加えて以下を実行する

```diff
+export DB_DBNAME="devio2023db_r"
```

## GraphQL

### 利用方法

LINE認証処理は動作確認するために、プロバイダーを作成する必要があるため、処理をコメントアウトしています。
LINE認証を有効化したい場合、`web-api/src/handlers/resolvers/session-resolver.ts`該当箇所をアンコメントして下さい。


### 共通(LINE認証をアンコメントした場合)

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
