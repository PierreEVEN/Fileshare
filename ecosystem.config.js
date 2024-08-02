module.exports = {
  apps : [{
    name: "fileshare",
    script: "npm run prod",
    env: {
      NODE_ENV: "production",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
