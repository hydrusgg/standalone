import axios from 'axios'

export default axios.create({
  baseURL: 'https://api.hydrus.gg/plugin/v1',
  headers: {
    authorization: 'Bearer '+process.env.TOKEN
  }
})