var semver = require("semver")
var depTypes = ["dependencies","devDependencies","optionalDependencies"]
var extractDescription = require("./extract_description")

module.exports = fixer = {
  fixRepositoryField: function(data) {
    if (data.repostories) {
      this.warn("'repositories' (plural) Not supported.\n" +
           "Please pick one as the 'repository' field");
      data.repository = data.repositories[0]
    }
    if (!data.repository) return;
    if (typeof data.repository === "string") {
      data.repository = {
        type: "git",
        url: data.repository
      }
    }
    var r = data.repository.url || ""
    // use the non-private urls
    r = r.replace(/^(https?|git):\/\/[^\@]+\@github.com/, 
      '$1://github.com')
    r = r.replace(/^https?:\/\/github.com/, 
      'git://github.com')
    if (r.match(/github.com\/[^\/]+\/[^\/]+\.git\.git$/)) {
      this.warn("Probably broken git url: " + r)
    }
  }

, fixFilesField: function(data) {
    var files = data.files
    if (files && !Array.isArray(files)) {
      this.warn("Invalid 'files' member")
      delete data.files
    }
  }

, fixBinField: function(data) {
    if (!data.bin) return;
    if (typeof data.bin === "string") {
      var b = {}
      b[data.name] = data.bin
      data.bin = b
    }
  }

, fixManField: function(data) {
    if (!data.man) return;
    if (typeof data.man === "string") {
      data.man = [ data.man ]
    }
  }
, fixBundleDependenciesField: function(data) {
    var bdd = "bundledDependencies"
    var bd = "bundleDependencies"
    if (data[bdd] && !data[bd]) {
      data[bd] = data[bdd]
      delete data[bdd]
    }
  }

, fixDependencies: function(data) {
    objectifyDeps(data, this.warn)
    addOptionalDepsToDeps(data, this.warn)
    this.fixBundleDependenciesField(data)
  }

, fixKeywordsField: function (data, warn) {
    if (typeof data.keywords === "string") {
      data.keywords = data.keywords.split(/,\s+/)
    }
  }

, fixVersionField: function(data) {
    if (!data.version) {
      data.version = ""
      return true
    }
    if (!semver.valid(data.version)) {
      throw new Error("invalid version: "+ data.version)
    }
    data.version = semver.clean(data.version)
    return true
  }

, fixPeople: function(data) {
    modifyPeople(data, unParsePerson)
    modifyPeople(data, parsePerson)  
  }  

, fixNameField: function(data) {
    if (!data.name) {
      data.name = ""
      return true
    }
    data.name = data.name.trim()
    ensureValidName(data.name)
  }
  

, fixDescriptionField: function (data) {
    if (data.description && typeof data.description !== 'string') {
      this.warn("'description' field should be a string")
      delete data.description
    }
    if (data.readme && !data.description)
      data.description = extractDescription(data.readme)
  }
  
, fixReadmeField: function (data) {
    if (!data.readme) data.readme = "ERROR: No README data found!"
  }
  
, fixBugsField: function(data) {
    var url
    if (!data.bugs && data.repository && data.repository.url) {
      url = data.repository.url
      // inference below was taken from code for "npm bugs" command
      if (url.match(/^(https?:\/\/|git(:\/\/|@))github.com/)) {
        url = url.replace(/^git(@|:\/\/)/, "https://")
                 .replace(/^https?:\/\/github.com:/, "https://github.com/")
                 .replace(/\.git$/, '')+"/issues"
        data.bugs = url
      }
    }    
  }
}

function ensureValidName (name) {
  if (name.charAt(0) === "." ||
      name.match(/[\/@\s\+%:]/) ||
      name !== encodeURIComponent(name) ||
      name.toLowerCase() === "node_modules" ||
      name.toLowerCase() === "favicon.ico") {
        throw new Error("Invalid name: " + JSON.stringify(name))
  }
}

function modifyPeople (data, fn) {
  if (data.author) data.author = fn(data.author)
  ;["maintainers", "contributors"].forEach(function (set) {
    if (!Array.isArray(data[set])) return;
    data[set] = data[set].map(fn)
  })
  return data
}

function unParsePerson (person) {
  if (typeof person === "string") return person
  var name = person.name || ""
  var u = person.url || person.web
  var url = u ? (" ("+u+")") : ""
  var e = person.email || person.mail
  var email = e ? (" <"+e+">") : ""
  return name+email+url
}

function parsePerson (person) {
  if (typeof person !== "string") return person
  var name = person.match(/^([^\(<]+)/)
  var url = person.match(/\(([^\)]+)\)/)
  var email = person.match(/<([^>]+)>/)
  var obj = {}
  if (name && name[0].trim()) obj.name = name[0].trim()
  if (email) obj.email = email[1];
  if (url) obj.url = url[1];
  return obj
}

function addOptionalDepsToDeps (data, warn) {
  var o = data.optionalDependencies
  if (!o) return;
  var d = data.dependencies || {}
  Object.keys(o).forEach(function (k) {
    d[k] = o[k]
  })
  data.dependencies = d  
}

function depObjectify (deps) {
  if (!deps) return {}
  if (typeof deps === "string") {
    deps = deps.trim().split(/[\n\r\s\t ,]+/)
  }
  if (!Array.isArray(deps)) return deps
  var o = {}
  deps.forEach(function (d) {
    d = d.trim().split(/(:?[@\s><=])/)
    var dn = d.shift()
    var dv = d.join("")
    dv = dv.trim()
    dv = dv.replace(/^@/, "")
    o[dn] = dv
  })
  return o
}

function objectifyDeps (data, warn) {
  depTypes.forEach(function (type) {
    if (!data[type]) return;
    data[type] = depObjectify(data[type])
  })
}