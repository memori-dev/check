const ErrCheckHasNoChecks = new Error("check called with no checks")
const ErrNoOptions = new Error("no options were provided")
const ErrNotIterable = new Error("value was not iterable")

class Result extends AggregateError {
    isValid() {
        return this.errors.length === 0
    }

    must() {
        if (this.errors.length > 0) throw new AggregateError(this.errors)
    }

    constructor() {
        super([]);
    }
}

type CheckErrConstructor = {
    expected: unknown
    received: unknown
    [key: string | symbol]: unknown
}

class CheckErr extends Error {
    expected: unknown
    received: unknown

    [key: string | symbol]: unknown

    constructor({expected, received}: CheckErrConstructor) {
        super();
        Object.assign(this, arguments[0])
    }
}

type check = (argument: any) => CheckErr | void

function check(received: unknown, ...checks: check[]): Result {
    // Check checks isn't empty
    if (checks.length === 0) throw ErrCheckHasNoChecks

    const res = new Result()
    for (let i = 0; i < checks.length; i++) {
        const err = checks[i](received)
        if (err !== void 0) res.errors.push(err)
    }

    return res
}

const expect = {
    any(...expected: unknown[]): check {
        return function (received: unknown): CheckErr | void {
            for (let i = 0; i < expected.length; i++) {
                if (received === expected) return
            }

            return new CheckErr({expected, received})
        }
    },

    value(expected: unknown): check {
        return function (received: unknown): CheckErr | void {
            if (received === expected) return

            return new CheckErr({expected, received})
        }
    },

    not(...expected: unknown[]): check {
        return function (received: unknown): CheckErr | void {
            for (let i = 0; i < expected.length; i++) {
                if (received !== expected) continue

                return new CheckErr({expected, received})
            }
        }
    },

    type(expected: Function): check {
        return function (received: any): CheckErr | void {
            if (received?.constructor === expected) return

            return new CheckErr({expected, received: received?.constructor})
        }
    },

    optional(constructor: Function, ...options: (void | null)[]): check {
        // check options is not empty
        if (options.length === 0) throw ErrNoOptions

        const typeCheck = expect.type(constructor)

        return function (received: unknown): CheckErr | void {
            // Check
            if (typeCheck(received) === void 0) return

            // Options
            for (let i = 0; i < options.length; i++) {
                if (received === options[i]) return
            }

            return new CheckErr({expected: [constructor, ...options], received})
        }
    },

    instanceof(expected: Function): check {
        return function (received: unknown): CheckErr | void {
            if (received instanceof expected) return

            return new CheckErr({expected, received})
        }
    },

    property(property: string | symbol, expected: unknown): check {
        return function (received: any): CheckErr | void {
            if (received[property] === expected) return

            return new CheckErr({property, expected, received: received[property]})
        }
    },

    // key: check
    properties(expected: { [key: string | symbol]: check }): check {
        // Check checks isn't empty
        if (Object.values(expected).length === 0) throw ErrCheckHasNoChecks

        return function (received: any): CheckErr | void {
            const errs = []

            for (const key of Object.keys(expected)) {
                const err = expected[key](received[key])
                if (err === void 0) continue

                err.property = key
                errs.push(err)
            }

            if (errs.length > 0) return new CheckErr({expected, received, errs})
        }
    },

    forOf(check: check): check {
        return function (received: any): CheckErr | void {
            if (!(Symbol.iterator in received)) return new CheckErr({expected: check, received, err: ErrNotIterable})

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

            if (errs.length > 0) return new CheckErr({expected: check, received, errs})
        }
    },
}

const logic = {
    and(...checks: check[]): check {
        return function (received: unknown): CheckErr | void {
            const errs = []

            for (let i = 0; i < checks.length; i++) {
                const err = checks[i](received)
                if (err !== void 0) continue
                errs.push(err)
            }

            if (errs.length > 0) return new CheckErr({expected: checks, received, errs})
        }
    },

    or(...checks: check[]): check {
        return function (received: unknown): CheckErr | void {
            const errs = []

            for (let i = 0; i < checks.length; i++) {
                const err = checks[i](received)
                if (err === void 0) return
                errs.push(err)
            }

            return new CheckErr({expected: check, received, errs})
        }
    },
}

module.exports = {
    CheckErr,
    check,
    expect,
    logic,
}
