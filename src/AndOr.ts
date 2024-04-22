const filters: WhereFilter[] = [
  { op: 'or', children: [
    { name: 'post.title', value: 'x', op: 'contains' },
    { name: 'post.title', value: '5', op: 'contains' },
    { name: 'post.id', value: '2', op: 'equals' },
    { name: 'post.id', value: '4', op: 'equals' }
  ] },
  { op: 'or', children: [
    { name: 'post.title', value: '4', op: 'contains' }
  ] }
]

function whereFilter(filters: WhereFilter[], op = 'and') {
  return new Brackets(qb => filters.map(e => {
    const where = op == 'and' ? val => qb.andWhere(val) : val => qb.orWhere(val)
    if (e.op == 'and') {
      where(whereFilter(e.children!, 'and'))
    } else if (e.op == 'or') {
      where(whereFilter(e.children!, 'or'))
    } else {
      where(`${e.name} ${whereOp[e.op](e.value)}`)
    }
  }))
}
