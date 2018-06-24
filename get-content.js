const https = require('https');
const http = require('http');
const fs = require('fs');

const getContent = (url) => {
   
    return new Promise((resolve, reject) => {
        if(url.startsWith('./'))
        {
          return fs.readFile(url, (err, data) => {
            if(err)
              reject(err);
            else
              resolve(data);
          });
        }

        const get = url.startsWith('https') ? https.get : http.get;
        get(url, (resp) => {
            let data = '';
           
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
              data += chunk;
            });
           
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
              resolve(data);
            });
           
          }).on("error", (err) => {
            reject(err.message);
          });
    });        
}

module.exports.getContent = getContent;