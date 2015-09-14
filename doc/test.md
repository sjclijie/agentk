<!-- @rev fe3dd5ee279e2beed94511ee3dd97f49 20ae7b -->
# test

----




## Methods

------------------------------------------------------------------------
### run()

```js
function run(file) 
```


 Run a test script

**Params**

  - file `string`
    <br>pathname of a test script file
 


------------------------------------------------------------------------
### Test()

```js
function Test(name) 
```


 Unit test


**Params**

  - name `name`

**Returns**

> {Test}
     

------------------------------------------------------------------------
### test()

```js
function Test::test(title, cb) 
```




------------------------------------------------------------------------
### IntegrationTest()

```js
function IntegrationTest(name, handle) 
```


 Integration test on a router handle that accepts a http request and returns a http response


**Params**

  - name `string`
  - handle `function|router::Router`

**Returns**

> {IntegrationTest}
     

------------------------------------------------------------------------
### get()

```js
function IntegrationTest::get(url, options) 
```




------------------------------------------------------------------------
### postForm()

```js
function IntegrationTest::postForm(url, params, options) 
```




------------------------------------------------------------------------
### request()

```js
function IntegrationTest::request(options) 
```




------------------------------------------------------------------------
### summary()

```js
function summary() 
```



