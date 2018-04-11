# Resize image

```bash
for i in *;
do
  convert $i -resize 25x25 dx/25/dy/25/$i
  convert $i -resize 50x50 dx/50/dy/50/$i
  convert $i -resize 300x300 dx/300/dy/300/$i
done
```

# Hard cache by nginx

```nginx
location ~ /stylesheet/(\.css) {
  root /Users/maxmellon/work/ghq/github.com/MaxMEllon/public/;
  add_header "Cache-Control: public, max-age=31536000";
}
```

# Hard cache by nginx (uploaded images)

```nginx
location ~ (\.jpeg$|\.png$|\.gif$) {
  root /Users/maxmellon/work/ghq/github.com/MaxMEllon/uploads/;
  access_log  /Users/maxmellon/log/nginx.static.log ltsv;
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

# Hard Cache と Soft Cache の違い

- Hard Cache

コンテンツをクライアントサイドでcacheする期間をサーバー側でヘッターを通して指定．
静的コンテンツの取得時に GET リクエストがサーバーに投げられなくなる
(擬似的に200を返却，cache form diskとなり，サーバーにはアクセスが発生しない)

- Soft Cache

ETag や Last-Modified をブラウザが覚えておき，ブラウザが保有しているcacheが
使えるかどうかをサーバー側に問い合わせ
GETリクエストは発生するので注意
（ETagの照合や，ファイル変更の確認の問い合わせが発生，302が帰ってくる）

# Session (mysql -> redis)

```diff
diff --git a/app.js b/app.js
index 2652236..bb65fa0 100644
--- a/app.js
+++ b/app.js
@@ -6,10 +6,19 @@ const path = require('path')
 const fs = require('fs')
 const os = require('os')
 const mimes = require('mime-types')
+const bluebird = require('bluebird')
 const mysql = require('mysql2')
 const cookieParser = require('cookie-parser')
 const bodyParser = require('body-parser')
 const cp = require('child_process')
+const Redis = require('redis')
+
+bluebird.promisifyAll(Redis.RedisClient.prototype)
+bluebird.promisifyAll(Redis.Multi.prototype)
+
+global.redis = Redis.createClient()
+global.Promise = bluebird
+
 const app = express()
 const readFile = promisify(fs.readFile)
 const execFile = promisify(cp.execFile)
@@ -36,26 +45,16 @@ app.use(cookieParser())
 app.use(async (req, res, next) => {
   const query = promisify(db.query.bind(db))
   const sessionId = req.cookies.session_id
-  try {
-    if (sessionId) {
-      const [session] = await query('SELECT * FROM session WHERE id=?', [sessionId])
-      if (session) {
-        if (session.expired_at > Date.now() / 1000) {
-          const [user] = await query('SELECT * FROM users WHERE username=?', [session.username])
-          await query('UPDATE session SET expired_at=? WHERE id=?', [
-            Number.parseInt(Date.now() / 1000 + 300),
-            sessionId
-          ])
-          req.user = user
-        } else {
-          await query('DELETE FROM session WHERE id=?', [sessionId])
-        }
-      }
+  if (sessionId) {
+    const username = await redis.getAsync(`session:${sessionId}`)
+    if (username) {
+      const [user] = await query('SELECT * FROM users WHERE username=?', [username])
+      req.user = user
+    } else {
+      await redis.delAsync(`session:${sessionId}`)
     }
-    next()
-  } catch (e) {
-    next(e)
   }
+  next()
 })

 const index = require('./routes/index')
@@ -68,12 +67,8 @@ const reservations = require('./routes/reservations')
 app.use('/', index)
 app.use('/initialize', async (req, res, next) => {
   try {
-    await exec(
-      `mysql -h ${process.env.RISUCON_DB_HOST || 'localhost'} -u${process.env.RISUCON_DB_USER ||
-        'root'} ${
-        process.env.RISUCON_DB_PASSWORD ? '-p' + process.env.RISUCON_DB_PASSWORD : ''
-      } ${process.env.RISUCON_DB_NAME || 'risukai'} < ${path.resolve('../sql/01_tables_data.sql')}`
-    )
+    await exec(`mysql -uroot -Drisukai < sql/01_tables_data.sql`)
+    await redis.flushdbAsync()
     res.send('OK')
   } catch (e) {
     next(e)
```

```diff
diff --git a/routes/login.js b/routes/login.js
index 16aace9..f31f721 100644
--- a/routes/login.js
+++ b/routes/login.js
@@ -37,12 +37,9 @@ router.post('/', async (req, res, next) => {
     }

     const sessionId = uuid()
-    await query(
-      'INSERT INTO session (id, username, expired_at) VALUES (?, ?, ?) on duplicate key update username=?',
-      [sessionId, username, Date.now() / 1000 + 300, username]
-    )
-    await connection.commit()
     res.cookie('session_id', sessionId)
+    await redis.setAsync(`session:${sessionId}`, user.username)
+    await connection.commit()
     res.redirect('/')
   } catch (e) {
     console.error(e)
diff --git a/routes/logout.js b/routes/logout.js
index f979edc..d6bfa0c 100644
--- a/routes/logout.js
+++ b/routes/logout.js
@@ -14,7 +14,7 @@ router.get('/', async (req, res, next) => {
       res.redirect('/')
       return
     }
-    await query('DELETE FROM session WHERE id=?', [sessionId])
+    await redis.delAsync(`session:${sessionId}`)
     res.clearCookie('session_id')
     res.redirect('/')
   } catch (e) {
diff --git a/routes/register.js b/routes/register.js
index 17bab60..dadc29b 100644
--- a/routes/register.js
+++ b/routes/register.js
@@ -79,11 +79,8 @@ router.post('/', uploads.single('icon'), async (req, res, next) => {
       [username, salt, hash, last_name, first_name, filename]
     )
     const sessionId = uuid()
-    await query('INSERT INTO session (id, username, expired_at) VALUES (?, ?, ?)', [
-      sessionId,
-      username,
-      Number.parseInt(Date.now() / 1000 + 300)
-    ])
+    res.cookie('session_id', sessionId)
+    await redis.setAsync(`session:${sessionId}`, username)
     await connection.commit()

     res.cookie('session_id', sessionId)
```


