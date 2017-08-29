'use strict'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)
const expect = chai.expect
const assert = chai.assert

import { constants } from 'fs'
import mockfs from 'mock-fs'
import FS from 'fs'
import Process from 'process'
import Textfile from '../src'


describe(`Textfile`, function() {

	////////////////
	// READ TESTS //
	////////////////

	describe(`.read()`, function() {

		before(function() {
			mockfs({
				'/Users/testman/TEXTFILE/test/dir/file.blank': '',
				'/Users/testman/TEXTFILE/test/dir/file.txt': 'hello',
				'/Users/testman/TEXTFILE/test/dir/file-undef.json': 'undefined',
				'/Users/testman/TEXTFILE/test/dir/file-false.json': 'false',
				'/Users/testman/TEXTFILE/test/dir/file.json-bad': '{"is_broken:true',
				'/Users/testman/TEXTFILE/test/dir/file.json': '{"it_reads":true}'
			})
		})

		it(`!exists(dir) //> undefined`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/fiction/dir/file.fiction')

			return assert.eventually.equal(
				sf.read(),
				undefined,
				`resolves with undefined when directories don't exist`
			)
		})

		it(`!exists(file) //> undefined`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/test/dir/file.fiction')

			return assert.eventually.equal(
				sf.read(),
				undefined,
				`resolves with undefined when the target file doesn't exist`
			)
		})

		it(`0 bytes //> undefined | ''`, function() {
			let sf1 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.blank')
			let sf2 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.blank', { json: false })

			return Promise.all([
				assert.eventually.equal(
					sf1.read(),
					undefined,
					`resolves with undefined when file contains empty string`
				),
				assert.eventually.equal(
					sf2.read(),
					'',
					`resolves with undefined when file contains empty string`
				)
			])
		})

		it(`!json //> text`, function() {
			let sf1 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.json', { json: false })
			let sf2 = new Textfile('/Users/testman/TEXTFILE/test/dir/file-undef.json', { json: false })
			let sf3 = new Textfile('/Users/testman/TEXTFILE/test/dir/file-false.json', { json: false })
			let sf4 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.json-bad', { json: false })

			return Promise.all([
				assert.eventually.equal(
					sf1.read(),
					`{"it_reads":true}`,
					`reads standard json correctly`
				),
				assert.eventually.equal(
					sf2.read(),
					`undefined`,
					`recognizes "undefined" as undefined`
				),
				assert.eventually.equal(
					sf3.read(),
					`false`,
					`understands a file that contains only one scalar`
				),
				assert.eventually.equal(
					sf4.read(),
					`{"is_broken:true`,
					`works fine when content isn't valid JSON`
				)
			])
		})

		it(`json //> undefined | scalar | object | Error`, function() {
			let sf1 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.json')
			let sf2 = new Textfile('/Users/testman/TEXTFILE/test/dir/file-undef.json')
			let sf3 = new Textfile('/Users/testman/TEXTFILE/test/dir/file-false.json')
			let sf4 = new Textfile('/Users/testman/TEXTFILE/test/dir/file.json-bad')

			return Promise.all([
				assert.eventually.deepEqual(
					sf1.read(),
					{it_reads:true},
					`reads standard json correctly`
				),
				assert.eventually.equal(
					sf2.read(),
					undefined,
					`recognizes "undefined" as undefined`
				),
				assert.eventually.equal(
					sf3.read(),
					false,
					`understands a file that contains only one scalar`
				),
				assert.isRejected(
					sf4.read(),
					SyntaxError
				)
			])
		})
	})


	/////////////////
	// WRITE TESTS //
	/////////////////

	describe(`.write()`, function() {

		before(function() {
			mockfs({
				'/Users/testman/TEXTFILE/': {
					'blank.json': ''
				}
			})
		})

		it(`writes json`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/blank.json')

			return sf.write( {it_writes:true} )
			.then(() => {
				let writtenValue = FS.readFileSync('/Users/testman/TEXTFILE/blank.json', { encoding: 'utf8' })
				assert.equal(writtenValue, '{"it_writes":true}', `writes standard JSON correctly`)
			})
		})

		it(`writes plain text`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/blank.txt', { json: false })

			return sf.write( 'it_writes = true' )
			.then(() => {
				assert.equal(
					FS.readFileSync('/Users/testman/TEXTFILE/blank.txt', { encoding: 'utf8' }),
					'it_writes = true',
					`writes text correctly`
				)
			})
		})

		it(`throws instead of writing an object to text file`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/blank.txt', { json: false })

			assert.eventually.throws(
				sf.write( {throws_when_object_for_text:true} )
			)
		})

		/*
		it(`can detect JSON errors`, function() {

			let objectA = { name: 'A' }, objectB = { name: 'B' }
			objectA.link = objectB
			objectB.link = objectA

			assert.throws(
				() => {
					let x = JSON.stringify([objectA, objectB])
				},
				TypeError,
				'Converting circular structure to JSON'
			)
		})

		it(`can detect async JSON errors`, function() {

			let objectA = { name: 'A' }, objectB = { name: 'B' }
			objectA.link = objectB
			objectB.link = objectA

			assert.eventually.throws(
				new Promise((resolve, reject) => {
					let x = JSON.stringify([objectA, objectB])
					resolve(x)
				}),
				TypeError,
				'Converting circular structure to JSON'
			)
		})
		*/

		it(`throws if json data unserializable`, function() {
			let sf = new Textfile('/Users/testman/TEXTFILE/blank.json')

			let objectA = { name: 'A' }, objectB = { name: 'B' }
			objectA.link = objectB
			objectB.link = objectA

			assert.throws(
				() => sf.write( [objectA, objectB] ), // seems like it should be just sf.write, but I guess not...
				TypeError, 'Converting circular structure to JSON'
			)
		})

		it(`creates the file if necessary`, function() {
			let path = '/Users/testman/TEXTFILE/nonexistent.json'

			assert.throws(
				() => FS.accessSync(path),
				Error, `ENOENT, no such file or directory '/Users/testman/TEXTFILE/nonexistent.json'`
			)

			let sf = new Textfile(path)
			sf.write({it_creates_files:true}, { async: false })

			assert.equal(
				FS.readFileSync(path, { encoding: 'utf8' }),
				`{"it_creates_files":true}`
			)
		})

		it(`creates directories if necessary`, function() {
			let dir = '/Users/testman/TEXTFILE/nonexistent-dir'
			let path = dir + '/nonexistent.file'

			assert.throws(
				() => FS.accessSync(dir),
				Error, `ENOENT, no such file or directory '${dir}'`
			)

			let sf = new Textfile(path, { async: false })
			sf.write({it_creates_dirs:true})

			assert.doesNotThrow(
				() => FS.accessSync(dir),
				Error, `ENOENT, no such file or directory '${dir}'`
			)
		})

		it(`throws if unable to create directory or file`, function() {
			mockfs({
				'/Users/otheruser': mockfs.directory({
					uid: process.getuid(),
					mode: 700,
					items: {
						'TEXTFILE/file.json': '{"I_am":true}'
					}
				})
			})

			assert.throws(
				() => FS.accessSync('/Users/otheruser/TEXTFILE/file.json'),
				Error, 'EACCES, permission denied'
			)

			let sf = new Textfile('/Users/otheruser/TEXTFILE/file.json')

			assert.eventually.throws(
				sf.write({i_am_forbidden:true}, {})
			)
		})

		it(`returns undefined on success`, function() {
			mockfs({
				'/Users/testman/TEXTFILE': {}
			})

			let sf = new Textfile('/Users/testman/TEXTFILE/bools.json')

			return sf.write({ truthy: true, falsey: false })
			.then(val => {
				assert.isUndefined(val)
			})
		})
	})

	after(function() {
		mockfs.restore()
	})

})