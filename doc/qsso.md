<!-- @rev 30196e2855909cf52b73b790f62a9bb0 20ae7b -->
# qsso

Qunar single site login helper


----





## Methods

------------------------------------------------------------------------
### qsso()

```js
function qsso (options, onuser) 
```




**Params**

  - options `object`
    <br>optional arguments, which contains:

   - login_url `string`: callback url when user is not login, defaults to `/login`
   - cookie_name `string`: cookie name used to save login info, defaults to `AKUID`
   - cookie_expires `number`: cookie expiration time in seconds, defaults to 30 days
   - cookie_domain `string`: cookie domain name, defaults to `qunar.com`
   - cookie_secret `string`: cookie encryption key, defaults to MAC address
   - admin_email `string`: admin email address to be shown up when user is not in the grant list
   - email_title `string`: default email title to be added when user is not in the grant list

  - onuser `function`
    <br>callback called when user access, should return any value if user is permitted
   or `false` if user is not permitted
 


## Module default
