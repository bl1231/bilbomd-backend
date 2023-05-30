const { expect } = require('chai')

const app = require('../server')

describe('Testing app creation', () => {
  it('App is correctly exported', () => {
    expect(typeof app).to.equal('function')
  })
})
