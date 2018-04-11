'use strict'

const express = require('express')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const os = require('os')
const mimes = require('mime-types')
const bluebird = require('bluebird')
const mysql = require('mysql2')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cp = require('child_process')
const Redis = require('redis')

bluebird.promisifyAll(Redis.RedisClient.prototype)
bluebird.promisifyAll(Redis.Multi.prototype)

global.redis = Redis.createClient()
global.Promise = bluebird

const app = express()
const readFile = promisify(fs.readFile)
const execFile = promisify(cp.execFile)
const exec = promisify(cp.exec)

const db = mysql.createPool({
  host: process.env.RISUCON_DB_HOST || 'localhost',
  port: process.env.RISUCON_DB_PORT || 3306,
  user: process.env.RISUCON_DB_USER || 'root',
  password: process.env.RISUCON_DB_PASSWORD,
  database: process.env.RISUCON_DB_NAME || 'risukai',
  connectionLimit: 100,
  charset: 'utf8mb4'
})

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.set('db', db)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

app.use(async (req, res, next) => {
  const query = promisify(db.query.bind(db))
  const sessionId = req.cookies.session_id
  if (sessionId) {
    const username = await redis.getAsync(`session:${sessionId}`)
    if (username) {
      const [user] = await query('SELECT * FROM users WHERE username=?', [username])
      req.user = user
    } else {
      await redis.delAsync(`session:${sessionId}`)
    }
  }
  next()
})

const index = require('./routes/index')
const login = require('./routes/login')
const logout = require('./routes/logout')
const register = require('./routes/register')
const users = require('./routes/users')
const reservations = require('./routes/reservations')

app.use('/', index)
app.use('/initialize', async (req, res, next) => {
  try {
    await exec(`mysql -uroot -Drisukai < sql/01_tables_data.sql`)
    await redis.flushdbAsync()
    res.send('OK')
  } catch (e) {
    next(e)
  }
})
app.use('/login', login)
app.use('/logout', logout)
app.use('/register', register)
app.use('/users', users)
app.use('/reservations', reservations)

module.exports = app
