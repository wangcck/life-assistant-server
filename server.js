const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

const app = express()
const port = process.env.PORT || 3002

app.use(cors())
app.use(bodyParser.json())

// 确保数据目录存在
const dataDir = '/data'
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true })
  } catch (e) {
    console.log('Cannot create /data, using local data folder')
  }
}

// 创建/连接 SQLite 文件数据库
const dbPath = path.join(dataDir || __dirname, 'life-assistant.db')
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err)
  } else {
    console.log('Connected to SQLite database at:', dbPath)
    initDatabase()
  }
})

const initDatabase = () => {
  db.run(`CREATE TABLE IF NOT EXISTS family_groups (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    create_time TEXT NOT NULL
  )`)
  
  db.run(`CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    identity TEXT NOT NULL,
    join_time TEXT NOT NULL,
    FOREIGN KEY (group_code) REFERENCES family_groups(code)
  )`)
}

app.post('/family/create', (req, res) => {
  const { name, userId, identity } = req.body
  if (!name || !userId) return res.json({ code: 400, message: '参数错误', data: null })

  const code = Math.floor(10000 + Math.random() * 90000).toString()
  const createTime = new Date().toLocaleDateString('zh-CN')
  
  db.run('BEGIN TRANSACTION')
  db.run('INSERT INTO family_groups (code, name, create_time) VALUES (?, ?, ?)', [code, name, createTime], (err) => {
    if (err) { db.run('ROLLBACK'); return res.json({ code: 500, message: '创建失败', data: null }) }
    db.run('INSERT INTO family_members (group_code, user_id, identity, join_time) VALUES (?, ?, ?, ?)', [code, userId, identity || '家庭成员', createTime], (err) => {
      if (err) { db.run('ROLLBACK'); return res.json({ code: 500, message: '创建失败', data: null }) }
      db.run('COMMIT')
      getGroupByCode(code, (group) => res.json({ code: 200, message: '创建成功', data: group }))
    })
  })
})

app.post('/family/get', (req, res) => {
  const { code } = req.body
  if (!code) return res.json({ code: 400, message: '邀请码不能为空', data: null })
  getGroupByCode(code, (group) => {
    if (group) res.json({ code: 200, message: '查询成功', data: group })
    else res.json({ code: 404, message: '邀请码不存在', data: null })
  })
})

app.post('/family/join', (req, res) => {
  const { code, userId, identity } = req.body
  if (!code || !userId) return res.json({ code: 400, message: '参数错误', data: null })
  
  db.get('SELECT * FROM family_groups WHERE code = ?', [code], (err, group) => {
    if (err || !group) return res.json({ code: 404, message: '邀请码不存在', data: null })
    db.get('SELECT * FROM family_members WHERE group_code = ? AND user_id = ?', [code, userId], (err, member) => {
      if (member) {
        getGroupByCode(code, (g) => res.json({ code: 400, message: '您已在该家庭组', data: g }))
        return
      }
      db.run('INSERT INTO family_members (group_code, user_id, identity, join_time) VALUES (?, ?, ?, ?)', [code, userId, identity || '家庭成员', new Date().toLocaleDateString('zh-CN')], (err) => {
        if (err) return res.json({ code: 500, message: '加入失败', data: null })
        getGroupByCode(code, (g) => res.json({ code: 200, message: '加入成功', data: g }))
      })
    })
  })
})

const getGroupByCode = (code, callback) => {
  db.get('SELECT * FROM family_groups WHERE code = ?', [code], (err, group) => {
    if (!group) return callback(null)
    db.all('SELECT user_id AS id, identity, join_time FROM family_members WHERE group_code = ?', [code], (err, members) => {
      callback({ name: group.name, code: group.code, members: members || [], createTime: group.create_time })
    })
  })
}

app.get('/', (req, res) => {
  res.send('🎉 生活助手服务器运行中！')
})

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`)
  })
}

module.exports = app
