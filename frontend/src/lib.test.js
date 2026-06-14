import assert from 'node:assert/strict'
import { severity } from './lib.js'

assert.equal(severity(0.5).bar, '#2FE6A3')
assert.equal(severity(1.5).bar, '#F6C65B')
assert.equal(severity(4).bar, '#FF5E6C')

console.log('lib color tests passed')
