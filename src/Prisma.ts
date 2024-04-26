import { isObject } from "@vue/shared"
import { DataSource, EntityMetadata, QueryBuilder, QueryRunner, SelectQueryBuilder } from "typeorm"
import { keyBy } from 'lodash-es'
import { Alias } from "typeorm/query-builder/Alias.d.ts"
import { DriverUtils } from "typeorm/driver/DriverUtils.js"
import { RelationMetadata } from "typeorm/metadata/RelationMetadata.js"
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata.js"

type OP = 'contains' | 'endsWith' | 'equals' | 'gt' | 'gte' | 'in' | 'lt' | 'lte' | 'not' | 'notIn' | 'startsWith'

const opMap: Record<OP, (val: any) => string> = {
  contains: p => `LIKE ${p}`,
  startsWith: p => `LIKE ${p}`,
  endsWith: p => `LIKE ${p}`,
  equals: p => `= ${p}`,
  not: p => `!= ${p}`,
  gt: p => `> ${p}`,
  gte: p => `>= ${p}`,
  lt: p => `< ${p}`,
  lte: p => `<= ${p}`,
  in: p => `IN (${p.join(',')})`, 
  notIn: p => `NOT IN (${p.join(',')})`
}

type Val = string | number | boolean
type BasicFilter = Val | FindOper
type Where = Record<string, BasicFilter | ListRelationFilter | Record<string, BasicFilter | ListRelationFilter>>
type ListRelationFilter = { some?: Where; every?: Where; none?: Where }

type FindOper = StringOper | IntOper | BoolOper

type StringOper = {
  contains: string
  startsWith: string
  endsWith: string
  equals: string
  not: string
  gt: string
  gte: string
  lt: string
  lte: string
  in: string[]
  notIn: string[]
}

type IntOper = {
  equals: number
  not: number
  gt: number
  gte: number
  lt: number
  lte: number
  in: number[]
  notIn: number[]
}

type BoolOper = {
  equals: boolean
  not: boolean
}

type FindOpt<T> = {
  select?: Select<T>
  where?: Where
  orderBy?: Record<string, 'asc' | 'desc'>
  take?: number
  skip?: number
}

type Select<T> = {
  [K in keyof T]?: T[K] extends Val
    ? boolean
    : T[K] extends any[]
      ? FindOpt<T[K]>
      : Pick<FindOpt<T[K]>, 'select' | 'where'>
}

export class Prisma<T> extends SelectQueryBuilder<any> {

  #options: FindOpt<T> = {}

  constructor(queryBuilder: QueryBuilder<any>)
  constructor(connection: DataSource, queryRunner?: QueryRunner)
  constructor() {
    super(...arguments)
    this.expressionMap.relationLoadStrategy = 'query'
  }

  find() {
    return this.findMany()[0]
  }

  async findMany() {
    const rows = await this.getRawMany()
    if (!rows.length) return rows

    // broadcast all "after load" events
    const mainAlias = this.expressionMap.mainAlias!, metadata = mainAlias.metadata
    // if (expressionMap.callListeners === true && expressionMap.mainAlias!.hasMetadata) {
    //   await queryRunner.broadcaster.broadcast("Load", expressionMap.mainAlias.metadata, entities);
    // }
    const select = this.#options.select!
    const all = Object.keys(select).filter(k => select[k] && metadata.hasRelationWithPropertyPath(k)).map(async k => {
      
    })
    await Promise.all(all)
    return rows
  }

  async #loadRel(rel: RelationMetadata, entities: any[]) {
    const k = rel.propertyName
    const select = this.#options.select!
    const opt = isObject(select[k]) ? select[k] : {}
    const qb = this.#create()
    const t = rel.inverseEntityMetadata.targetName
    qb.from(rel.inverseEntityMetadata.tableName, t)

    qb.buildOptions(opt)

    let cols1: ColumnMetadata[], cols2: ColumnMetadata[]

    if (rel.isManyToMany) {
      const mid = rel.junctionEntityMetadata!.tableName
      const cols = rel.isOwning ? rel.junctionEntityMetadata!.ownerColumns : rel.junctionEntityMetadata!.inverseColumns
      const exp = cols.map(col => `${mid}.${col.propertyName} IN (${entities.map(e => qb.createParameter(e[col.referencedColumn!.propertyName])).join(',')})`).join(' AND ')
      qb.innerJoin(mid, mid, exp)
    }
    else if (rel.isOneToMany || rel.isOneToOneNotOwner) {
      const cols = rel.inverseRelation!.joinColumns
      const exp = cols.map(col => `${t}.${col!.propertyName} IN (${entities.map(e => qb.createParameter(e[col.referencedColumn!.propertyName])).join(',')})`).join(' AND ')
      qb.andWhere(exp)
      const rows = await qb.findMany()
      if (cols.length == 1) {
        const keybyed = keyBy(rows, cols[0].referencedColumn!.propertyName)
        entities.forEach(e =>
          e[rel.propertyName] = keybyed[e[cols[0].propertyName]] || null
        )
      } else {
        entities.forEach(e =>
          e[rel.propertyName] = rows.find(row => cols.every(col => col.compareEntityValue(e, row[col.referencedColumn!.propertyName]))) || null
        )
      }
    }
    else if (rel.isManyToOne || rel.isOneToOneOwner) {
      cols1 = rel.joinColumns
      cols2 = rel.
      const cols = rel.joinColumns
      const exp = cols.map(col => `${t}.${col.referencedColumn!.propertyName} IN (${entities.map(e => qb.createParameter(e[col.propertyName])).join(',')})`).join(' AND ')
      qb.andWhere(exp)
      const rows = await qb.findMany()
      if (cols.length == 1) {
        const keybyed = keyBy(rows, cols[0].referencedColumn!.propertyName)
        entities.forEach(e =>
          e[rel.propertyName] = keybyed[e[cols[0].propertyName]] || null
        )
      } else {
        entities.forEach(e =>
          e[rel.propertyName] = rows.find(row => cols.every(col => col.compareEntityValue(e, row[col.referencedColumn!.propertyName]))) || null
        )
      }
    }
  }

  buildOptions(opt?: FindOpt<T>) {
    const mainAlias = this.expressionMap.mainAlias!
    opt = { ...opt || {} }
    opt.select ??= mainAlias.metadata.columns.map(e => e.propertyName).reduce((o, k) => (o[k] = true, o), {})
    this.#options = opt
    this.#select(opt.select!)
    return this
  }

  #create() {
    return new Prisma(this.connection)
  }

  subQuery() {
    const qb = this.#create();
    qb.expressionMap.subQuery = true;
    qb.parentQueryBuilder = this;
    return qb;
  }

  #select(obj: Select<T>) {
    const mainAlias = this.expressionMap.mainAlias!
    const selects = this.expressionMap.selects ||= []
    const { metadata } = this.expressionMap.mainAlias!
    for (const k in obj) {
      const rel = metadata.findRelationWithPropertyPath(k)
      const val = obj[k]
      if (rel && val) {
        if (rel.isManyToMany) {
          const cols = rel.isOwning ? rel.junctionEntityMetadata!.ownerColumns : rel.junctionEntityMetadata!.inverseColumns
          cols.forEach(col => {
            selects.push({ selection: `${mainAlias.name}.${col.referencedColumn!.propertyName}`, aliasName: col.referencedColumn!.propertyName })
          })
        }
        else if (rel.isOneToMany || rel.isOneToOneNotOwner) {
          rel.inverseRelation!.joinColumns.forEach(col => {
            selects.push({ selection: `${mainAlias.name}.${col.referencedColumn!.propertyName}`, aliasName: col.referencedColumn!.propertyName })
          })
        }
        else if (rel.isManyToOne || rel.isOneToOneOwner) {
          rel.joinColumns.forEach(col => {
            selects.push({ selection: `${mainAlias.name}.${col.propertyName}`, aliasName: col.propertyName })
          })
        }
      }
      else if (val) {
        selects.push({ selection: `${mainAlias.name}.${k}`, aliasName: k })
      }
      // DriverUtils.buildAlias()
    }
  }

  buildWhereExp(where: Where) {
    const alias = this.expressionMap.mainAlias!
    return this.#buildWhereExp(this, where, alias.metadata, alias.name)
  }

  // can't support `embed`
  #buildWhereExp(sqb: Prisma, where: Where, metadata: EntityMetadata, alias: string) {
    let exp = ''
    for (const k in where) {
      const column = metadata.findColumnWithPropertyPathStrict(k)
      const relation = metadata.findRelationWithPropertyPath(k)
      const path = `${alias}.${k}`
      const val = where[k]
      if (column) {
        if (isObject(val)) {
          const findOper = val as FindOper
          for (const op in findOper) {
            const opVal = findOper[op]
            let param
            switch (op) {
              case 'contains': param = this.createParameter(`%${opVal}%`); break
              case 'startsWith': param = this.createParameter(`%${opVal}`); break
              case 'endsWith':  param = this.createParameter(`${opVal}%`); break
              case 'in':
              case 'notIn': param = opVal.map(e => this.createParameter(e)); break
              default: param = this.createParameter(opVal)
            }
            exp += ` AND ${path} ${opMap[op](param)}`
          }
        }
        else if (val !== undefined) {
          exp += ` AND ${path} = ${this.createParameter(val)}`
        }
      }
      else if (relation) {
        if (relation.isManyToMany) {
          const joinTableName = relation.isOwning ? relation.joinTableName : relation.inverseRelation!.joinTableName
          const joinColumn = relation.isOwning ? relation.joinColumns[0] : relation.inverseRelation!.inverseJoinColumns[0]
          const refer = `${alias}.${joinColumn.referencedColumn!.propertyName}`
          const sub = sqb.subQuery()
          sub.select(`${joinTableName}.${joinColumn.propertyName}`)
          sub.from(joinTableName, joinTableName)
          // sub.where(`${refer} = ${joinTableName}.${joinColumn.propertyName}`)
          sub.andWhere(this.#buildWhereExp(sub, val.some, relation.inverseEntityMetadata, joinTableName))
          // sqb.andWhere(refer + ' IN ' + sub.getSql())
          exp += ` AND ${refer} IN ${sub.getSql()}`
        }
        else if (relation.isOneToMany) {
          const joinTableName = relation.inverseEntityMetadata.tableName
          const joinColumn = relation.inverseRelation!.joinColumns[0]
          const refer = `${alias}.${joinColumn.referencedColumn!.propertyName}`
          const sub = sqb.subQuery()
          sub.select(`${joinTableName}.${joinColumn.propertyName}`)
          sub.from(joinTableName, joinTableName)
          // sub.where(`${refer} = ${joinColumn.propertyName}`)
          sub.andWhere(this.#buildWhereExp(sub, val.some, relation.inverseEntityMetadata, joinTableName))
          // sqb.andWhere(refer + ' IN ' + sub.getSql())
          exp += ` AND ${refer} IN ${sub.getSql()}`
        }
        else {
          // todo 1-1

          const joinAlias = alias + '__' + relation.propertyName
          const relExp = this.#buildWhereExp(sqb, val as Where, relation.inverseEntityMetadata, joinAlias)
          if (relExp) {
            sqb.leftJoin(`${alias}.${relation.propertyName}`, joinAlias)
            exp += ` AND (${relExp})`
          }
        }
      }
    }
    if (exp) exp = exp.slice(5)
    return exp
  }

  #raw2entity(raws: any[], alias: Alias) {

  }
}