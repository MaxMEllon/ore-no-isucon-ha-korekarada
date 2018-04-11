'use strict'

const express = require('express')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const os = require('os')
const mimes = require('mime-types')
const mysql = require('mysql2')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cp = require('child_process')
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
  try {
    if (sessionId) {
      const [session] = await query('SELECT * FROM session WHERE id=?', [sessionId])
      if (session) {
        if (session.expired_at > Date.now() / 1000) {
          const [user] = await query('SELECT * FROM users WHERE username=?', [session.username])
          await query('UPDATE session SET expired_at=? WHERE id=?', [
            Number.parseInt(Date.now() / 1000 + 300),
            sessionId
          ])
          req.user = user
        } else {
          await query('DELETE FROM session WHERE id=?', [sessionId])
        }
      }
    }
    next()
  } catch (e) {
    next(e)
  }
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
    await exec(
      `mysql -h ${process.env.RISUCON_DB_HOST || 'localhost'} -u${process.env.RISUCON_DB_USER ||
        'root'} ${
        process.env.RISUCON_DB_PASSWORD ? '-p' + process.env.RISUCON_DB_PASSWORD : ''
      } ${process.env.RISUCON_DB_NAME || 'risukai'} < ${path.resolve('../sql/01_tables_data.sql')}`
    )
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
