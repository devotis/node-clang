const isObject = o => (!!o) && (o.constructor === Object)
const arrayWithObjects = (a, n, orMore) => {
  if (!Array.isArray(a)) return false
  if (a.length !== n && !orMore || orMore && a.length < n) return false

  let nonEmptyObjects = a.filter(o=>isObject(o) && Object.keys(o).length).length
  if (nonEmptyObjects !== n && !orMore || orMore && nonEmptyObjects < n) return false

  return true
}
const faultcode = err => {
  return err && err.Fault && err.Fault.faultcode * 1
}

module.exports = {
  isObject,
  arrayWithObjects,
  faultcode
}
