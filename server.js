const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express()

// 使用环境变量获取端口，Vercel会自动设置
const port = process.env.PORT || 3002

app.use(cors())
app.use(bodyParser.json())

// 添加请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// 使用内存存储（Vercel Serverless 模式下会重置，但足以演示）
const users = []
let tokenCounter = 1

app.post('/auth/login', (req, res) => {
  const { account, password } = req.body
  
  const user = users.find(u => u.account === account && u.password === password)
  
  if (user) {
    const token = `token_${tokenCounter++}_${Date.now()}`
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          account: user.account
        }
      }
    })
  } else {
    res.json({
      code: 401,
      message: '账号或密码错误',
      data: null
    })
  }
})

app.post('/auth/register', (req, res) => {
  const { account, password } = req.body
  
  if (!account || !password) {
    return res.json({
      code: 400,
      message: '参数错误',
      data: null
    })
  }
  
  const exists = users.find(u => u.account === account)
  
  if (exists) {
    return res.json({
      code: 400,
      message: '账号已存在',
      data: null
    })
  }
  
  const newUser = {
    id: users.length + 1,
    account,
    password
  }
  
  users.push(newUser)
  
  res.json({
    code: 200,
    message: '注册成功',
    data: {
      user: {
        id: newUser.id,
        account: newUser.account
      }
    }
  })
})

app.post('/auth/forgot-password', (req, res) => {
  const { phone, code, password } = req.body
  
  const user = users.find(u => u.account === phone)
  
  if (!user) {
    return res.json({
      code: 400,
      message: '账号不存在',
      data: null
    })
  }
  
  user.password = password
  
  res.json({
    code: 200,
    message: '密码修改成功',
    data: null
  })
})

app.get('/', (req, res) => {
  res.send('🎉 生活助手服务器运行中！')
})

// Vercel Serverless 模式需要导出 app
module.exports = app

// 本地开发时运行
if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`)
  })
}
