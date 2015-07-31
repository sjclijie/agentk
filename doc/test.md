<!-- @rev 75b1a3bbfecfdd2a8baa50f7374e2e97 215fda -->
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
### summary()

```js
function summary() 
```



