// Extend prototype: Implement helper methods.
(function (Uploader, $) {

    "use strict";

    $.extend(Uploader.prototype, {

        /**
         * Generate a unique id.
         *
         * @param prefix
         * @returns {string}
         */
        uniqueId:function(prefix) {
            return this.options.uniqueIdPrefix + prefix + '_' + this.constructor.uniqueIncrement++;
        },

        /**
         * Replace parameter names with their values in the given error message, based on the given `file` and `this.options`.
         *
         * @param message
         * @param file
         * @return {string}
         */
        errorMessage: function(message, file) {

            var fileName = this.isModernBrowser ? file.name : this.getFileName(file.val());
            var fileSize = this.isModernBrowser ? file.size : null;

            // We are multiplying with 1024 because the values in `this.options.acceptSize` are in KB
            var allowedMinSize = $.isNumeric(this.options.acceptSize[0]) ? this.options.acceptSize[0] * 1024 : null;
            var allowedMaxSize = $.isNumeric(this.options.acceptSize[1]) ? this.options.acceptSize[1] * 1024 : null;

            var parameters = {
                fileName: fileName,
                fileSize: this.formatBytes(fileSize),
                fileExtension: this.getFileExtension(fileName),
                allowedExtensions: (this.options.acceptType || []).join(),
                allowedMinSize: this.formatBytes(allowedMinSize),
                allowedMaxSize: this.formatBytes(allowedMaxSize),
                maxFiles: this.options.maxFiles
            };

            $.each(parameters, function(name, value) {
                message = message.replace(new RegExp("{{" + name + "}}", "gi" ), value);
            });

            return message;
        },

        /**
         * Extract filename from path.
         *
         * @param path
         * @return {string}
         */
        getFileName: function(path) {
            return path.replace(/\\/g, "/").split("/").pop();
        },

        /**
         * Extract file extension from filename.
         *
         * @param fileName
         * @return {string}
         */
        getFileExtension: function(fileName) {
            var parts = fileName.split(".");
            return (parts.length > 1) ? parts.pop() : "";
        },

        /**
         * Format file size.
         *
         * @param bytes
         * @return {string}
         */
        formatBytes: function(bytes) {
            var sizes = ["KB", "MB", "GB", "TB"];
            for (var i = sizes.length; i > 0; i--) {
                if (bytes >= Math.pow(1024, i)) {
                    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i - 1];
                }
            }

            return bytes + " Bytes";
        }
    });

}(window.Uploader, jQuery));