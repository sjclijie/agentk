<!-- @rev 8eb01834051159ba1a54954fa98f93ae 20ae7b -->
# q_watcher

Qunar Watcher module
 

----


 Helper for using [Watcher](http://watcher.corp.qunar.com/).

 This module helps pushing monitor data to watcher system.



## Variable Fields

### prefix

 metric prefix of the log entry, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 to get the proper metric prefix

#### type
{string}
 

#### value
`'t'`


### server

 remote server to push the log to, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 to get the proper remote server

#### type
{string}
 

#### value
`'qmon-beta.corp.qunar.com'`


### port

#### type
{number}

#### value
`2013`



## Methods

------------------------------------------------------------------------
### setupPeers()

```js
function setupPeers(hosts, localhost, port) 
```


 Set up data combination and calculation for multiple servers.


**Params**

  - hosts `Array`
    <br>hostnames of all servers
  - localhost `string`
    <br>this server's hostname
  - port(optional) `number`
    <br>port number to communicate with other servers, default to 8012
 


------------------------------------------------------------------------
### add()

```js
function add(name, time) 
```


 Increase a record's count by 1, a time can be supplied


**Params**

  - name `string`
    <br>last name of the monitor record
  - time(optional) `number`
    <br>time of the monitor record
 


------------------------------------------------------------------------
### set()

```js
function set(name, number) 
```


 Set a record's number


**Params**

  - name `string`
    <br>last name of the monitor record
  - number `number`
    <br>number to be set to
 


------------------------------------------------------------------------
### addMulti()

```js
function addMulti(name, count) 
```


 Increase a record's count by a varible number


**Params**

  - name `string`
    <br>last name of the monitor record
  - count `number`
    <br>value to be increased
 


------------------------------------------------------------------------
### register()

```js
function register(name, cb) 
```


 Register a callback for a metric. The callback will be called every one minute for the current value.


**Params**

  - name `string`
    <br>last name of the metric
  - cb `Function`
    <br>callback that will be queried for the value of the metric
 

