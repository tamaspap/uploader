// Extend prototype: Implement event handlers.
(function (Uploader, $) {

    "use strict";

    $.extend(Uploader.prototype, {

        /**
         * One or more files were selected by the user.
         */
        onFileSelect: function() {

            // The list of File objects for modern browsers, the file input element for the older ones.
            var files = this.isModernBrowser ? this.$fileInput[0].files : [this.$fileInput];

            // Add the files to the file list.
            this.addToList(files);

            if ( ! this.isModernBrowser) {

                // Detach the file input, but don't remove it (we will need it when submitting the file to the server).
                this.$fileInput.off().detach();
            }
            else {

                // Remove the file input (we got the File objects from it, so we don't need it anymore).
                this.$fileInput.remove();
            }

            // Create new file input element, to make selecting new files possible.
            this.createFileInput();
        },

        /**
         * A new file was added to the list.
         *
         * @param uniqueId
         * @param name
         * @param file
         */
        onFileAdd: function(uniqueId, name, file) {

            // Trigger "fileAdd"
            this.trigger("fileAdd", uniqueId, name, file);
        },

        /**
         * A file was removed from the list.
         *
         * @param uniqueId
         * @param name
         */
        onFileRemove: function(uniqueId, name) {

            // Trigger "fileRemove"
            this.trigger("fileRemove", uniqueId, name);
        },

        /**
         * A file validation failed.
         *
         * @param name
         * @param error
         */
        onFileInvalid: function(name, error) {

            // Trigger "fileInvalid"
            this.trigger("fileInvalid", name, error);
        },

        /**
         * The max files limit was reached.
         *
         * @param name
         * @param message
         */
        onTooManyFiles: function(name, message) {

            // Trigger "tooManyFiles"
            this.trigger("tooManyFiles", name, message);
        },

        /**
         * Everything is ready to upload.
         *
         * Some final setup can be made via event handlers.
         *
         * @param uniqueId
         * @param name
         * @param data
         * @param xhr
         */
        onBeforeUpload: function(uniqueId, name, data, xhr) {

            // Trigger "beforeUpload"
            this.trigger("beforeUpload", uniqueId, name, data, xhr);
        },

        /**
         * A file started uploading.
         *
         * @param uniqueId
         * @param name
         */
        onUploadStart: function(uniqueId, name) {

            // Init the progress object
            var now = new Date().getTime();

            this.fileList[uniqueId].progress = {
                startTime: now,
                endTime: null,
                previous: {
                    time: null,
                    bytes: 0
                },
                current: {
                    time: now,
                    bytes: 0
                }
            };

            // Trigger uploadStart
            this.trigger("uploadStart", uniqueId, name);
        },

        /**
         * Upload progress.
         *
         * @param uniqueId
         * @param name
         * @param loaded
         * @param total
         */
        onUploadProgress: function(uniqueId, name, loaded, total) {

            // Update progress
            var now = new Date().getTime();

            var progress =  this.fileList[uniqueId].progress;
            progress.previous = {
                time: progress.current.time,
                bytes: progress.current.bytes
            };

            progress.current = {
                time: now,
                bytes: loaded
            };

            if (loaded == total) {
                progress.endTime = now;
            }

            // Trigger "uploadProgress"
            this.trigger("uploadProgress", uniqueId, name, loaded, total);
        },

        /**
         * The upload was completed.
         *
         * @param uniqueId
         * @param name
         * @param response
         * @param status
         * @param xhr
         */
        onUploadComplete: function(uniqueId, name, response, status, xhr) {
            /**
             * When an upload is completed it means that the browser has sent the file to the server successfully, and
             * also got a response from it. By default we assume that a completed upload is also a successful upload.
             *
             * Therefore when an upload is completed, it's the developers job to check if the upload was successful or not,
             * based on the server's response. If the upload was unsuccessful, developers must throw an error with the
             * name: `UploadError`, and a message to call the `onUploadFail` method with.
             *
             * NOTE! For iFrame uploads `status` and `xhr` are null.
             */
            try {

                // Trigger "uploadComplete"
                this.trigger("uploadComplete", uniqueId, name, response, status, xhr);

                // Change status to: "COMPLETED"
                this.fileList[uniqueId].status = this.constructor.STATUS_COMPLETED;

                // Remove the hidden form and iFrame from the DOM
                if ( ! this.isModernBrowser) {
                    this.iFrameCleanUp(uniqueId);
                }

                // Upload next file from the pending list (if any)
                this.uploadNext();
            }
            catch (error) {
                if (error.name == "UploadError") {

                    // There was an error, call onUploadFail
                    this.onUploadFail(uniqueId, name, this.errorMessage(error.message, this.fileList[uniqueId].file));
                }
                else {

                    // This is not an UploadError, re-throw it
                    throw error;
                }
            }
        },

        /**
         * The upload was failed.
         *
         * This happens when a network error occurs (the server is down or the user looses the internet connection), but
         * also when the upload is completed but it isn't successful. For example: the browser has sent the file to the
         * server, but the server was unable to save the file and responded with an error message.
         *
         * @param uniqueId
         * @param name
         * @param message
         */
        onUploadFail: function(uniqueId, name, message) {

            // Change status to: "FAILED"
            this.fileList[uniqueId].status = this.constructor.STATUS_FAILED;

            // Trigger "uploadFail"
            this.trigger("uploadFail", uniqueId, name, message);

            // Upload was unsuccessful, update the file count
            this.fileCount--;

            // Remove the hidden form and iFrame from the DOM
            if ( ! this.isModernBrowser) {
                this.iFrameCleanUp(uniqueId);
            }

            if (this.options.removeOnFail) {

                // Remove the file from the file list
                this.removeFromList(uniqueId);
            }

            // Upload next file from the pending list (if any)
            this.uploadNext();
        },

        /**
         * The upload was aborted by the user.
         *
         * @param uniqueId
         * @param name
         */
        onUploadAbort: function(uniqueId, name) {

            // Trigger "uploadAbort"
            this.trigger("uploadAbort", uniqueId, name);

            // Upload wasn't finished, update the file count
            this.fileCount--;

            // Remove the hidden form and iFrame from the DOM
            if ( ! this.isModernBrowser) {
                this.iFrameCleanUp(uniqueId);
            }

            // Remove file from file list
            this.removeFromList(uniqueId);

            // Upload next file from the pending list (if any)
            this.uploadNext();
        },

        /**
         * Register an event handler for an event.
         *
         * @param event
         * @param callback
         * @return {*}
         */
        on: function(event, callback) {
            this.eventHandlers[event] = this.eventHandlers[event] || [];
            this.eventHandlers[event].push(callback);

            // Make chaining possible
            return this;
        },

        /**
         * Remove all the handlers of an event.
         *
         * If no event is specified, all the handlers of all events will be removed.
         *
         * @param event
         */
        off: function(event) {
            if (event) {
                delete this.eventHandlers[event];
            }
            else {
                this.eventHandlers = {};
            }
        },

        /**
         * Execute all the handlers attached to an event.
         *
         * NOTE! Some event handlers may throw errors intentionally. For example the handlers of the "uploadComplete" event
         * may throw an error after processing the server's response, if they consider the upload unsuccessful.
         * We want to catch these errors to make sure all handlers are executed, then re-throw the latest
         * error.
         */
        trigger: function() {
            var lastError, event = arguments[0];

            this.eventHandlers[event] = this.eventHandlers[event] || [];

            // Try to execute all handlers associated with this event
            for (var i = 0; i < this.eventHandlers[event].length; i++) {
                try {
                    this.eventHandlers[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
                }
                catch (error) {
                    if (error.name == "UploadError") {

                        // Update last error
                        lastError = error;
                    }
                    else {

                        // This is not an upload error, re-throw it
                        throw error;
                    }
                }
            }

            if (lastError) {

                // We have an error, let's re-throw it
                throw lastError;
            }
        }
    });

}(window.Uploader, jQuery));
