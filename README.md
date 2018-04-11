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

```
location ~ /stylesheet/(\.css) {
  root /Users/maxmellon/work/ghq/github.com/MaxMEllon/public/;
  add_header "Cache-Control: public, max-age=31536000";
}
```

# Hard cache by nginx (uploaded images)

```
location ~ (\.jpeg$|\.png$|\.gif$) {
  root /Users/maxmellon/work/ghq/github.com/MaxMEllon/uploads/;
  access_log  /Users/maxmellon/log/nginx.static.log ltsv;
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```


