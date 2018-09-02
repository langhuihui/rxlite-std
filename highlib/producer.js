const {
    Sink,
    noop,
} = require('./common')
const {
    share
} = require('./combination')

exports.subject = source => {
    const subSink = new Sink()
    share(sink => {
        subSink.sink = sink
        source && source(subSink)
    })
    return subSink
}

exports.fromArray = array => sink => {
    // asap(() => {
    //         let pos = 0
    //         const l = array.length
    //         while (pos < l && !sink.disposed) sink.next(array[pos++])
    //         sink.complete()
    //     }, () => sink.dispose())
    // asap(() => {
    //     sink.pos = 0
    //     const l = array.length
    //     while (sink.pos < l && !sink.disposed) sink.next(array[sink.pos++])
    //     sink.complete()
    // }, () => sink.dispose())
    sink.pos = 0
    const l = array.length
    while (sink.pos < l && !sink.disposed) sink.next(array[sink.pos++])
    sink.complete()
}
exports.of = (...items) => exports.fromArray(items)
exports.interval = period => sink => {
    let i = 0;
    sink.defer([clearInterval, , setInterval(() => sink.next(i++), period)])
}
exports.timer = (delay, period) => sink => {
    const defer = [clearTimeout, , setTimeout(() => {
        defer[0] = clearInterval
        let i = 0;
        defer[2] = setInterval(() => sink.next(i++), period)
    }, delay)]
    sink.defer(defer)
}
exports.fromEventPattern = (add, remove) => sink => {
    const n = d => sink.next(d);
    sink.defer([remove, , n])
    add(n)
}
exports.fromEvent = (target, name) => typeof target.on == 'function' ? exports.fromEventPattern(handler => target.on(name, handler), handler => target.off(name, handler)) : exports.fromEventPattern(handler => target.addEventListener(name, handler), handler => target.removeEventListener(name, handler))
exports.range = (start, count) => (sink, pos = start, end = count + start) => {
    while (pos < end && !sink.disposed) sink.next(pos++)
    sink.complete()
}

exports.fromPromise = source => sink => {
    source.then(d => (sink.next(d), sink.complete())).catch(e => sink.complete(e))
}

exports.fromIterable = source => sink => {
    try {
        for (let data of source) {
            sink.next(data)
            if (sink.disposed) return
        }
        sink.complete()
    } catch (err) {
        sink.complete(err)
    }
}
exports.from = source => {
    switch (true) {
        case source instanceof Array:
            return exports.fromArray(source)
        case source instanceof Promise:
            return exports.fromPromise(source)
        case source[Symbol.iterator] && typeof source[Symbol.iterator] === 'function':
            return exports.fromIterable(source)
        default:
            return exports.of(source)
    }
}
exports.bindCallback = (call, thisArg, ...args) => sink => {
    const inArgs = args.concat((...rargs) => (sink.next(rargs.length > 1 ? rargs : rargs[0]), sink.complete()));
    call.apply ? call.apply(thisArg, inArgs) : call(...inArgs)
}
exports.bindNodeCallback = (call, thisArg, ...args) => sink => {
    const inArgs = args.concat((err, ...rargs) => (err && sink.complete(err)) || (sink.next(rargs.length > 1 ? rargs : rargs[0]), sink.complete()));
    call.apply ? call.apply(thisArg, inArgs) : call(...inArgs)
}
exports.never = noop
exports.throwError = e => sink => sink.complete(e)
exports.empty = exports.throwError()