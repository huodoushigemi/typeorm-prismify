import { isObject } from "@vue/shared"
import { EntityMetadata, SelectQueryBuilder } from "typeorm"

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

type FindOpt = {
  select?: Record<string, boolean | FindOpt>
  where?: Where
  orderBy?: Record<string, 'asc' | 'desc'>
  take?: number
  skip?: number
}

export class Prisma extends SelectQueryBuilder<any> {

  _create() {
    return new Prisma(this.connection)
  }

  subQuery() {
    const qb = this._create();
    qb.expressionMap.subQuery = true;
    qb.parentQueryBuilder = this;
    return qb;
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
}