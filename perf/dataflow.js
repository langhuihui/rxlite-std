var Benchmark = require('benchmark');
var fast = require('../highlib');
var lite = require('../stdlib')
var channel = require('../channel')
var node = require('../nodelib')
var callbag = require('callbag-basics')
var xs = require('xstream').default;
var most = require('most');
var rxOp = require('rxjs/operators');
var rxjs = require('rxjs')
var bacon = require('baconjs');

var runners = require('./runners');
var fromArray = require('./callbag-listenable-array');
var kefirFromArray = runners.kefirFromArray;

// Create a stream from an Array of n integers
// filter out odds, map remaining evens by adding 1, then reduce by summing
var seed = 100;
var x = seed;
var goingUp = true;
var n = runners.getIntArg(1000000);
var a = new Array(n);
for (var i = 0; i < a.length; ++i) {
    if (x > Number('1e+100')) {
        goingUp = false;
    }
    if (x < 100) {
        goingUp = true;
    }
    if (goingUp) {
        x *= 7;
    } else {
        x /= 7;
    }
    a[i] = Math.sin(x);
}

var suite = Benchmark.Suite('dataflow for ' + n + ' source events');
var options = {
    defer: true,
    onError: function (e) {
        e.currentTarget.failure = e.error;
    }
};

suite.add('rx4rx-lite', function (deferred) {
        var source = lite.fromArray(a);
        var inc = lite.pipe(
            source,
            lite.filter(isPositive),
            lite.map(returnPlus1)
        );
        var dec = lite.pipe(
            source,
            lite.filter(isNegative),
            lite.map(returnMinus1)
        );
        var count = lite.pipe(
            lite.merge(inc, dec),
            lite.scan(addXY, 0)
        );
        var label = lite.fromArray(['initial', 'Count is ']);
        var view = lite.pipe(
            lite.combineLatest(label, count),
            lite.map(renderWithArray)
        );
        runners.runLite(deferred, view);
    }, options)
    .add('rx4rx-fast', function (deferred) {
        var source = fast.fromArray(a);
        var inc = fast.pipe(
            source,
            fast.filter(isPositive),
            fast.map(returnPlus1)
        );
        var dec = fast.pipe(
            source,
            fast.filter(isNegative),
            fast.map(returnMinus1)
        );
        var count = fast.pipe(
            fast.merge(inc, dec),
            fast.scan(addXY, 0)
        );
        var label = fast.fromArray(['initial', 'Count is ']);
        var view = fast.pipe(
            fast.combineLatest(label, count),
            fast.map(renderWithArray)
        );
        runners.runFast(deferred, view);
    }, options)
    .add('cb-basics', function (deferred) {
        var source = fromArray(a);
        var inc = callbag.pipe(
            source,
            callbag.filter(isPositive),
            callbag.map(returnPlus1)
        );
        var dec = callbag.pipe(
            source,
            callbag.filter(isNegative),
            callbag.map(returnMinus1)
        );
        var count = callbag.pipe(
            callbag.merge(inc, dec),
            callbag.scan(addXY, 0)
        );
        var label = fromArray(['initial', 'Count is ']);
        var view = callbag.pipe(
            callbag.combine(label, count),
            callbag.map(renderWithArray)
        );
        runners.runCallbag(deferred, view);
    }, options)
    .add('xstream', function (deferred) {
        var source = xs.fromArray(a);
        var inc = source.filter(isPositive).mapTo(+1);
        var dec = source.filter(isNegative).mapTo(-1);
        var count = xs.merge(inc, dec).fold(addXY, 0);
        var label = xs.of('initial', 'Count is ');
        var view = xs.combine(label, count).map(renderWithArray);
        runners.runXStream(deferred, view);
    }, options)
    .add('most', function (deferred) {
        var source = most.from(a);
        var inc = source.filter(isPositive).map(returnPlus1);
        var dec = source.filter(isNegative).map(returnMinus1);
        var count = most.merge(inc, dec).scan(addXY, 0);
        var label = most.from(['initial', 'Count is ']);
        var view = most.combine(renderWithArgs, label, count);
        runners.runMost(deferred, view.drain());
    }, options)
    .add('rx 6', function (deferred) {
        var source = rxjs.from(a);
        var {
            map,
            filter,
            scan
        } = rxOp
        var inc = source.pipe(filter(isPositive), map(returnPlus1));
        var dec = source.pipe(filter(isNegative), map(returnMinus1));
        var count = rxjs.merge(inc, dec).pipe(scan(addXY, 0));
        var label = rxjs.of('initial', 'Count is ');
        var view = rxjs.combineLatest(label, count).pipe(map(renderWithArgs));
        runners.runRx6(deferred, view);
    }, options)
// .add('bacon', function(deferred) {
//     var source = bacon.fromArray(a);
//     var inc = source.filter(isPositive).map(returnPlus1);
//     var dec = source.filter(isNegative).map(returnMinus1);
//     var count = inc.merge(dec).scan(0, addXY);
//     var label = bacon.fromArray(['initial', 'Count is ']);
//     var view = bacon.combineWith(renderWithArgs, label, count);
//     runners.runBacon(deferred, view);
// }, options)

runners.runSuite(suite);

function isNegative(x) {
    return x < 0;
}

function isPositive(x) {
    return x > 0;
}

function addXY(x, y) {
    return x + y;
}

function returnPlus1() {
    return +1;
}

function returnMinus1() {
    return -1;
}

function renderWithArray(labelAndCount) {
    return {
        label: labelAndCount[0],
        count: labelAndCount[1],
    };
}

function renderWithArgs(label, count) {
    return {
        label: label,
        count: count,
    };
}