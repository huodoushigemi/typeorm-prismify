import { EntitySchema } from "typeorm"

export const User = new EntitySchema({
  name: 'user',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    name: { type: 'varchar' },
    namw2: { type: 'varchar', name: 'nameXxx', nullable: true },
  },
  relations: {
    posts: {
      type: 'one-to-many',
      target: 'post',
      inverseSide: 'user',
      createForeignKeyConstraints: false,
    }
  }
})

export const Post = new EntitySchema({
  name: 'post',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    title: { type: 'varchar' },
    content: { type: 'varchar', nullable: true },
    as: { type: 'varchar', nullable: true },
    // user: null,
    // tags: null,
  },
  relations: {
    user: {
      type: 'many-to-one',
      target: 'user',
      inverseSide: 'posts',
      createForeignKeyConstraints: false,
      // joinColumn: { referencedColumnName: 'id' },
    },
    tags: {
      type: 'many-to-many',
      target: 'tag',
      inverseSide: 'posts',
      joinTable: true,
      createForeignKeyConstraints: false,
      // joinColumn: { referencedColumnName: 'id' },
    }
  }
})

export const Tag = new EntitySchema({
  name: 'tag',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    name: { type: 'varchar' },
  },
  relations: {
    posts: {
      type: 'many-to-many',
      target: 'post',
      inverseSide: 'tags',
      // createForeignKeyConstraints: false,
      // joinColumn: { referencedColumnName: 'id' },
    }
  }
})