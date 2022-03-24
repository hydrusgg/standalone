import './src/env.js'
import rtc from './src/rtc.js'
import api from './src/api.js'
import * as commands from './src/commands.js'
import { setTimeout } from 'timers/promises'

let queue = []

rtc.on('EXECUTE_COMMAND', (payload) => {
  queue.push(payload)
  work()
})

rtc.on('EXECUTE_COMMANDS', (payload) => {
  queue.push(...payload)
  work()
})

async function work() {
  if (queue.length && !queue.working) {
    queue.working = true

    let job
    while (job = queue.shift()) {
      let status = 'done', message = 'OK'

      try {
        const [name, ...args] = job.command.split(' ').map(it => Number(it) || it)

        if (typeof commands[name] !== 'function') {
          throw Error('Command not found')
        }
        let response = await commands[name](...args)
        if (response != null && String(response) == response) {
          message = response.substring(0,255)
        }
      } catch (err) {
        status = 'failed'
        message = err.message.substring(0, 255)
      } finally {
        while (true) {
          try {
            await api.patch(`commands/${job.id}`, { status, message })
            console.log('Command processed [%d] (%s) -> %s', job.id, status, job.command)
            break
          } catch {
            console.error('Failed to process command [%d] -> %s', job.id, job.command)
            await setTimeout(10e3)
          }
        }
      }
    }

    queue.working = false
  }
}