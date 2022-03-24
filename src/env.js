import env from 'dotenv'

const { error } = env.config()

if (error) {
  if (error.message.includes('no such file or directory')) {
    console.error('Please, rename the .env.example to .env')
  } else {
    console.error(error.message)
  }
  process.exit()
}