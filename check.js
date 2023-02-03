const ErrCheckHasNoChecks = new Error("check called with no checks")
const ErrExpectedFunction = new Error("expected function")
const ErrExpectedPropertyKey = new Error("expected property key")
const ErrExpectedOneArgument = new Error("expected function to take one argument")
const ErrNoOptions = new Error("no options were provided")
const ErrNotIterable = new Error("value was not iterable")

class Result {
    errors = []

    isValid() {
        return this.errors.length === 0
    }

    must() {
        if (this.errors.length > 0) throw new AggregateError(this.errors)
    }
}

class CheckErr extends Error {
    expected
    received

    constructor({expected, received}) {
        super();
        Object.assign(this, arguments[0])
    }
}

function checkCheck(check) {
    if (typeof check !== "function") throw ErrExpectedFunction
    if (check.length !== 1) throw ErrExpectedOneArgument
}

function checkChecks(...checks) {
    // Check checks isn't empty
    if (checks.length === 0) throw ErrCheckHasNoChecks

    // Check checks
    for (let i = 0; i < checks.length; i++) checkCheck(checks[i])
}

function check(received, ...checks) {
    checkChecks(...checks)

    const res = new Result()
    for (let i = 0; i < checks.length; i++) {
        const err = checks[i](received)
        if (err !== void 0) res.errors.push(err)
    }

    return res
}

const expect = {
    any(...expected) {
        return function(received) {
            for (let i = 0; i < expected.length; i++) {
                if (received === expected) return
            }

            return new CheckErr({expected, received})
        }
    },

    value(expected) {
        return function(received) {
            if (received === expected) return

            return new CheckErr({expected, received})
        }
    },

    not(...expected) {
        return function(received) {
            for (let i = 0; i < expected.length; i++) {
                if (received !== expected) continue

                return new CheckErr({expected, received})
            }
        }
    },

    type(expected) {
        // check expected is a function
        if (typeof expected !== "function") throw ErrExpectedFunction

        return function(received) {
            if (typeof received?.constructor === expected) return

            return new CheckErr({expected, received: received?.constructor})
        }
    },

    optional(constructor, ...options) {
        // check options is not empty
        if (options.length === 0) throw ErrNoOptions

        const typeCheck = expect.type(constructor)

        return function(received) {
            // Check
            if (typeCheck(received) === void 0) return

            // Options
            for (let i = 0; i < options.length; i++) {
                if (received === options[i]) return
            }

            return new CheckErr({expected: [constructor, ...options], received})
        }
    },

    instanceof(expected) {
        // check expected is a function
        if (typeof expected !== "function") throw ErrExpectedFunction

        return function(received) {
            if (received instanceof expected) return

            return new CheckErr({expected, received})
        }
    },

    property(property, expected) {
        if (typeof property !== "string" && typeof property !== "symbol") throw ErrExpectedPropertyKey

        return function(received) {
            if (received[property] === expected) return

            return new CheckErr({property, expected, received: received[property]})
        }
    },

    // key: check
    properties(object) {
        checkChecks(Object.values(object))

        return function(received) {
            const errs = []

            for (const key of Object.keys(object)) {
                const err = object[key](received[key])
                if (err === void 0) continue

                err.property = key
                errs.push(err)
            }

            if (errs.length > 0) return new AggregateError(errs)
        }
    },

    forOf(check) {
        checkCheck(check)

        return function(received) {
            if (!(Symbol.iterator in received)) return ErrNotIterable

            const errs = []

            let i = 0
            for (const value of received) {
                const err = check(value)
                if (err !== void 0) {
                    err.index = i
                    errs.push(err)
                }

                i++
            }

            if (errs.length > 0) return new AggregateError(errs)
        }
    },
}

const logic = {
    and(...checks) {
        checkChecks(...checks)

        return function(received) {
            const errs = []

            for (let i = 0; i < checks.length; i++) {
                const err = checks[i](received)
                if (err !== void 0) continue
                errs.push(err)
            }

            if (errs.length > 0) return new AggregateError(errs)
        }
    },

    or(...checks) {
        checkChecks(...checks)

        return function(received) {
            const errs = []

            for (let i = 0; i < checks.length; i++) {
                const err = checks[i](received)
                if (err === void 0) return
                errs.push(err)
            }

            return new AggregateError(errs)
        }
    },
}



module.exports = {
    CheckErr,
    check,
    expect,
    logic,
}
