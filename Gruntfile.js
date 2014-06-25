module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        concat: {
            options: {
                separator: "\n\n"
            },
            dist: {
                src: [
                    "uploader/uploader.js",
                    "uploader/init.js",
                    "uploader/events.js",
                    "uploader/methods.js",
                    "uploader/helpers.js"
                ],
                dest: "uploader.js"
            }
        },

        uglify: {
            options: {
                banner: "/*! <%= pkg.name %> <%= grunt.template.today('yyyy-dd-mm, h:MM:ss TT') %> */\n"
            },
            dist: {
                files: {
                    "uploader.min.js": ["uploader.js"]
                }
            }
        },

        jshint: {
            files: ["Gruntfile.js", "uploader/*.js"],
            options: {

                // Enable script urls
                scripturl: true,

                // Options here to override JSHint defaults
                globals: {
                    jQuery: true,
                    console: true,
                    document: true
                }
            }
        },

        watch: {
            javascript: {
                files: ["Gruntfile.js", "uploader/*.js"],
                tasks: ["concat"]
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-watch");

    grunt.registerTask("default", ["concat"]);
    grunt.registerTask("test", ["jshint"]);
    grunt.registerTask("build", ["concat", "uglify"]);

};
