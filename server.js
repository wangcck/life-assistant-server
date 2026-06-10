const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const sqlite3 = require('sqlite3').verbose()

const app = express()
const port = process.env.PORT || 3002

app.use(cors())
app.use(bodyParser.json())

// 创建/连接 SQLite 数据库
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Error opening database:', err)
  } else {
    console.log('Connected to SQLite database')
    initDatabase()
  }
})

// 初始化数据库表
const initDatabase = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS family_groups (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      create_time TEXT NOT NULL
    )
  `)
  
  db.run(`
    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      identity TEXT NOT NULL,
      join_time TEXT NOT NULL,
      FOREIGN KEY (group_code) REFERENCES family_groups(code)
    )
  `)
}

// 创建家庭组
app.post('/family/create', (req, res) => {
  const { name, userId, identity } = req.body
  
  if (!name || !userId) {
    return res.json({ code: 400, message: '参数错误', data: null })
  }

  // 生成5位邀请码
  const code = Math.floor(10000 + Math.random() * 90000).toString()
  
  const createTime = new Date().toLocaleDateString('zh-CN')
  
  // 事务插入数据
  db.run('BEGIN TRANSACTION')
  
  db.run(
    'INSERT INTO family_groups (code, name, create_time) VALUES (?, ?, ?)',
    [code, name, createTime],
    (err) => {
      if (err) {
        db.run('ROLLBACK')
        return res.json({ code: 500, message: '创建失败', data: null })
      }
      
      db.run(
        'INSERT INTO family_members (group_code, user_id, identity, join_time) VALUES (?, ?, ?, ?)',
        [code, userId, identity || '家庭成员', createTime],
        (err) => {
          if (err) {
            db.run('ROLLBACK')
            return res.json({ code: 500, message: '创建失败', data: null })
          }
          
          db.run('COMMIT')
          
          // 查询刚创建的家庭组
          getGroupByCode(code, (group) => {
            res.json({ code: 200, message: '创建成功', data: group })
          })
        }
      )
    }
  )
})

// 查询家庭组
app.post('/family/get', (req, res) => {
  const { code } = req.body
  
  if (!code) {
    return res.json({ code: 400, message: '邀请码不能为空', data: null })
  }
  
  getGroupByCode(code, (group) => {
    if (group) {
      res.json({ code: 200, message: '查询成功', data: group })
    } else {
      res.json({ code: 404, message: '邀请码不存在', data: null })
    }
  })
})

// 加入家庭组
app.post('/family/join', (req, res) => {
  const { code, userId, identity } = req.body
  
  if (!code || !userId) {
    return res.json({ code: 400, message: '参数错误', data: null })
  }
  
  // 检查家庭组是否存在
  db.get('SELECT * FROM family_groups WHERE code = ?', [code], (err, group) => {
    if (err || !group) {
      return res.json({ code: 404, message: '邀请码不存在', data: null })
    }
    
    // 检查是否已加入
    db.get(
      'SELECT * FROM family_members WHERE group_code = ? AND user_id = ?',
      [code, userId],
      (err, member) => {
        if (member) {
          // 查询完整家庭组信息
          getGroupByCode(code, (fullGroup) => {
            res.json({ code: 400, message: '您已在该家庭组', data: fullGroup })
          })
          return
        }
        
        // 添加成员
        db.run(
          'INSERT INTO family_members (group_code, user_id, identity, join_time) VALUES (?, ?, ?, ?)',
          [code, userId, identity || '家庭成员', new Date().toLocaleDateString('zh-CN')],
          (err) => {
            if (err) {
              return res.json({ code: 500, message: '加入失败', data: null })
            }
            
            getGroupByCode(code, (fullGroup) => {
              res.json({ code: 200, message: '加入成功', data: fullGroup })
            })
          }
        )
      }
    )
  })
})

// 辅助函数：获取家庭组完整信息
const getGroupByCode = (code, callback) => {
  db.get('SELECT * FROM family_groups WHERE code = ?', [code], (err, group) => {
    if (!group) {
      callback(null)
      return
    }
    
    db.all(
      'SELECT user_id AS id, identity, join_time FROM family_members WHERE group_code = ?',
      [code],
      (err, members) => {
        callback({
          name: group.name,
          code: group.code,
          members: members || [],
          createTime: group.create_time
        })
      }
    )
  })
}

// 健康检查
app.get('/', (req, res) => {
  res.send('🎉 生活助手服务器运行中！')
})

module.exports = app

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
  })
}
