import './style.css'

import 'reflect-metadata'
import { DataSource } from 'typeorm'

import initSqlJs from 'sql.js'
import localforage from 'localforage'
import wasm from "sql.js/dist/sql-wasm.wasm?url";
import { TableCtx } from '@orm-crud/core';
import { isObject, isString } from '@vue/shared';
import { Prisma } from './Prisma'

import * as entities from './entities'


window.localforage = localforage

const SQL = await initSqlJs({
  locateFile: (file: string) => wasm,
})


const ds = new DataSource({
  type: 'sqljs',
  driver: SQL,
  autoSave: true,
  logging: ['info', 'log', 'query'],
  location: "example_db",
  useLocalForage: true,
  synchronize: true,

  entities: Object.values(entities),
})

await ds.initialize()

// await ds.manager.upsert('user', { id: '1', name: 'xxxx' }, ['id'])
// await ds.manager.upsert(User, { id: '2', name: 'hhhh' }, ['id'])

// await ds.manager.upsert('post', { id: '1', title: 'xxx', content: 'content', user: { id: '1' } }, ['id'])
// await ds.manager.upsert('post', { id: '2', title: '222', content: 'content', user: { id: '1' } }, ['id'])
// await ds.manager.upsert('post', { id: '3', title: '333', content: 'content', user: { id: '2' } }, ['id'])
// await ds.manager.upsert(Post, { id: '4', title: '444', content: 'content', user: { id: '1' } }, ['id'])
// await ds.manager.upsert(Post, { id: '5', title: '555', content: 'content', user: { id: '1' } }, ['id'])
// await ds.manager.upsert(Post, { id: '5ew', title: 'asfr555', content: 'content', user: { id: '2' } }, ['id'])
// await ds.manager.upsert(Post, { id: 'post-tag-test', title: 'post-tag-test', content: 'post-tag-test', user: { id: '1' }, tags: [{ id: '1', name: 'class1' }] }, ['id'])

// await ds.manager

// await ds.manager.upsert('tag', { id: '1', name: 'class1', posts: [{ id: '2' }] }, ['id'])
// await ds.manager.upsert('tag', { id: '2', name: 'class2', posts: [{ id: '2' }] }, ['id'])
// await ds.manager.upsert('tag', { id: '3', name: 'class3', posts: [{ id: 'tag-test', title: 'tag-test', content: 'tag-test' }] }, ['id'])

// await ds.manager.createQueryBuilder().relation(Post, 'tags').of('1').remove('1')
// await ds.manager.createQueryBuilder().relation('post', 'tags').of('2').add('1')



const prisma = new Prisma(ds)
prisma.from('post', 'post')

console.log(ds.getMetadata('post').findRelationWithPropertyPath('user'));


console.log(
  prisma.replacePropertyNamesForTheWholeQuery(
    // prisma.buildWhereExp({
    //   // title: {
    //   //   contains: '',
    //   //   lt: ''
    //   // },
    //   // user: {
    //   //   name: ''
    //   // },
    //   tags: {
    //     some: {
    //       name: ''
    //     }
    //   }
    // })
    prisma.buildOptions({
      select: {
        title: true,
        as: true,
        user: true,
        tags: true
      },
      where: {
        // title: {
        //   contains: '',
        //   lt: ''
        // },
        // user: {
        //   name: ''
        // },
        tags: {
          some: {
            name: ''
          }
        }
      }
    }).getSql()
  ),
  '\n',
  // await ds.manager.createQueryBuilder()
  //   .select('post')
  //   .from('post', 'post')
  //   // .where({ title: 'x' })
  //   .getRawMany(),
  await ds.createQueryBuilder().from('post', 'post').setFindOptions({
    relationLoadStrategy: 'query',
    select: {
      id: true,
      // tags: true
      user: true
    },
    relations: ['user'],
    where: {

    }
  })
  .getMany()
)


  

// console.log(And(LessThan(1), MoreThan(1)));


// const uint8Array = ds.sqljsManager.exportDatabase()
// const blob = new Blob([uint8Array], { type: 'application/octet-stream' })
// const a = document.createElement('a')
// a.href = window.URL.createObjectURL(blob)
// a.download = 'sqlite.db'
// a.click()
// window.URL.revokeObjectURL(a.href)

