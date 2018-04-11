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

# Session (mysql -> redis)

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
