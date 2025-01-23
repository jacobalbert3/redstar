const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: "https://reds-332d72840274.herokuapp.com/",
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: false,
    pageLoadTimeout: 120000,
    defaultCommandTimeout: 60000,
    env: {
      MAPBOX_TOKEN: process.env.REACT_APP_MAPBOX_API_KEY
    }
  },
}) 