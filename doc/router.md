<!-- @rev 9022e2c767f61e463e0f9d26d0f8983d 20ae7b -->
# router

----




## Methods

------------------------------------------------------------------------
### Router()

```js
function Router(cb) 
```




**Params**

  - cb(optional) `function|Router`
    <br>handler first called before all rules

**Returns**

> {Router}

------------------------------------------------------------------------
### add()

```js
function Router::add(handle) 
```




------------------------------------------------------------------------
### all()

```js
function Router::all(cb) 
```




------------------------------------------------------------------------
### exact()

```js
function Router::exact(url, cb) 
```




------------------------------------------------------------------------
### prefix()

```js
function Router::prefix(prefix, cb) 
```




------------------------------------------------------------------------
### match()

```js
function Router::match(pattern, cb) 
```




------------------------------------------------------------------------
### test()

```js
function Router::test(tester) 
```




------------------------------------------------------------------------
### catcher()

```js
function Router::catcher(cb) 
```




------------------------------------------------------------------------
### apply()

```js
function Router::apply(req, args) 
```




------------------------------------------------------------------------
### complete()

```js
function Router::complete(cb) 
```




## Module default
