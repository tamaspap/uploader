/**
 * Ajax vs. iFrame uploads
 * ===========================================
 *
 * In modern browsers (supporting XHR uploads) files are uploaded using ajax, in older browsers using hidden iFrames.
 *
 * The workflow in modern browsers
 * ================================
 *
 * 1.   User selects files or drops files to the drop zone
 * 2.   After they are validated, the file objects from the file input or the drop zone are added to the file list
 *
 * Uploading a file:
 *
 * 3.   A form data is created
 * 4.   The file and additional data (from this.options.data) are appended to the form data
 * 5.   The form data is sent to the server via a XMLHttpRequest
 *
 *
 * The workflow in older browsers
 * ================================
 *
 * 1.   User selects a file (no dropping files is supported in this case)
 * 2.   The file input element used to select the file is added to the file list and detached from the DOM. Then it's
 *      replaced in DOM by a new file input element, to make selecting new files possible
 *
 * Uploading a file:
 *
 * 3.   A hidden form and a hidden iFrame are created
 * 4.   The iFrame is set as the target for the form
 * 5.   The file input element 'holding' the file, and additional data (from this.options.data) are appended to the form
 * 6.   The form is submitted to the server
 * 7.   When upload finishes, the form and the iFrame are removed from the DOM
 */


// Extend prototype: Implement API methods.
(function (Uploader, $, window, undefined) {

    "use strict";

    $.extend(Uploader.prototype, {

        /**
         * Add files to the file list.
         *
         * This method is called when new files are selected or drag & dropped to the drop zone.
         *
         * @param files
         */
        addToList: function(files) {

            $.each(files, $.proxy(function(i, file) {

                // Get the filename
                var fileName = this.isModernBrowser ? file.name : this.getFileName(file.val());

                // Make sure the max files limit wasn't reached yet
                if ( ! $.isNumeric(this.options.maxFiles) || this.fileCount < this.options.maxFiles) {
                    try {

                        // Check if the file is valid (whether it's type and size are allowed)
                        this.validateFile(file);

                        // Create a unique id for the file
                        var uniqueId = this.uniqueId("file");
                        this.$fileInput.attr("id", uniqueId);

                        // Add the file to the file list
                        this.fileList[uniqueId] = {
                            name: fileName,
                            file: file,
                            status: this.constructor.STATUS_ADDED
                        };

                        // Increment file count
                        this.fileCount++;

                        // Trigger onFileAdd
                        this.onFileAdd(uniqueId, fileName, file);

                        // Upload the file if autoUpload is true
                        if (this.options.autoUpload) {
                            this.upload(uniqueId);
                        }
                    }
                    catch (error) {
                        if (error.name == "FileValidationError") {

                            // The file validation failed
                            this.onFileInvalid(fileName, error);
                        }
                        else {
                            // This is not a file validation error, re-throw it
                            throw error;
                        }
                    }
                }
                else {

                    // The max files limit was reached
                    this.onTooManyFiles(fileName, this.errorMessage(this.options.errors.tooManyFiles, file));
                }
            }, this));
        },

        /**
         * Check if a file is valid (whether it's type and size are allowed).
         *
         * @param file
         * @return {boolean}
         */
        validateFile: function(file) {

            // Validation errors
            var errors = [];

            var fileName            = this.isModernBrowser ? file.name : this.getFileName(file.val());
            var fileSize            = this.isModernBrowser ? file.size : null;
            var fileExtension       = this.getFileExtension(fileName);
            var allowedExtensions   = this.options.acceptType;

            // We are multiplying with 1024 because the values in `this.options.acceptSize` are in KB
            var allowedMinSize = $.isNumeric(this.options.acceptSize[0]) ? this.options.acceptSize[0] * 1024 : null;
            var allowedMaxSize = $.isNumeric(this.options.acceptSize[1]) ? this.options.acceptSize[1] * 1024 : null;


            // Check if file type is accepted
            if (allowedExtensions && $.inArray("." + fileExtension, allowedExtensions) < 0) {

                // Invalid file type
                errors.push({
                    code: 1,
                    message: this.errorMessage(this.options.errors.invalidType, file)
                });
            }

            // Check if file size is accepted
            if ($.isNumeric(fileSize)) {
                if ($.isNumeric(allowedMinSize) && fileSize < allowedMinSize) {

                    // File size too small
                    errors.push({
                        code: 2,
                        message: this.errorMessage(this.options.errors.sizeTooSmall, file)
                    });
                }

                if ($.isNumeric(allowedMaxSize) && fileSize > allowedMaxSize) {

                    // File size too large
                    errors.push({
                        code: 3,
                        message: this.errorMessage(this.options.errors.sizeTooLarge, file)
                    });
                }
            }

            if (errors.length) {

                // The file validation failed. We throw a FileValidationError.
                throw {
                    name: 		"FileValidationError",
                    message:	"Invalid file.",
                    errors: 	errors
                };
            }

            return true;
        },

        /**
         * Upload a file.
         *
         * @param uniqueId
         */
        upload: function(uniqueId) {

            // Make sure the file isn't already uploading
            if ( ! this.isUploading(uniqueId)) {

                // Get the number of uploading files
                var filesUploading = this.countFiles(this.constructor.STATUS_UPLOADING);

                // Check if we can upload the file, or have to put it in the pending list
                if (filesUploading < this.options.simultaneousUploads) {

                    // If the file is in the pending list, remove it from there
                    if (this.isPending(uniqueId)) {
                        this.removeFromPendingList(uniqueId);
                    }

                    // Execute the appropriate "upload" method
                    this[this.isModernBrowser ? "ajaxUpload" : "iFrameUpload"](uniqueId);

                    // Change status to: "UPLOADING"
                    this.fileList[uniqueId].status = this.constructor.STATUS_UPLOADING;

                    // Upload was started
                    this.onUploadStart(uniqueId, this.fileList[uniqueId].name);
                }
                else {
                    // Put the file in the pending list and change it's status to "PENDING"
                    if ( ! this.isPending(uniqueId)) {
                        this.addToPendingList(uniqueId);
                        this.fileList[uniqueId].status = this.constructor.STATUS_PENDING;
                    }
                }
            }
        },

        /**
         * Upload all files.
         */
        uploadAll: function() {

            // Get the files from the file list with the status: "ADDED", and upload them one by one
            for (var uniqueId in this.fileList) {
                if (this.fileList[uniqueId].status == this.constructor.STATUS_ADDED) {
                    this.upload(uniqueId);
                }
            }
        },

        /**
         * Abort an upload request.
         *
         * @param uniqueId
         */
        abort: function(uniqueId) {

            // Make sure the file is uploading
            if (this.isUploading(uniqueId)) {

                // Call the appropriate abort method
                this[this.isModernBrowser ? "ajaxAbort" : "iFrameAbort"](uniqueId);
            }
        },

        /**
         * Abort all active requests.
         */
        abortAll: function() {

            // Get the files from the file list with the status: "UPLOADING", and abort their upload request
            for (var uniqueId in this.fileList) {
                if (this.fileList[uniqueId].status == this.constructor.STATUS_UPLOADING) {
                    this.abort(uniqueId);
                }
            }
        },

        /**
         * Check if a file is in the file list.
         *
         * @param uniqueId
         * @return {boolean}
         */
        inList: function(uniqueId) {
            return (typeof this.fileList[uniqueId] != "undefined");
        },

        /**
         * Remove a file from the file list.
         *
         * @param uniqueId
         */
        removeFromList: function(uniqueId) {
            var name = this.fileList[uniqueId].name;

            if (this.inList(uniqueId)) {
                delete this.fileList[uniqueId];
            }

            // A file was removed from the list
            this.onFileRemove(uniqueId, name);
        },

        /**
         * Count the files in the file list having the given status.
         * If no status is specified, the size of the whole list is returned.
         *
         * @param status
         * @returns {number}
         */
        countFiles: function(status) {
            var c = 0;
            for (var uniqueId in this.fileList) {
                if ( ! status || this.fileList[uniqueId].status == status) c++;
            }

            return c;
        },

        /**
         * Check if the file with the given uniqueId has the status: "ADDED".
         *
         * @param uniqueId
         * @returns {boolean}
         */
        isAdded: function(uniqueId) {
            return this.fileList[uniqueId].status == this.constructor.STATUS_ADDED;
        },

        /**
         * Check if the file with the given uniqueId has the status: "PENDING".
         *
         * @param uniqueId
         * @returns {boolean}
         */
        isPending: function(uniqueId) {
            return this.fileList[uniqueId].status == this.constructor.STATUS_PENDING;
        },

        /**
         * Check if the file with the given uniqueId has the status: "UPLOADING".
         * If no uniqueId is specified, check if there are any files uploading.
         *
         * @param uniqueId
         * @returns {boolean}
         */
        isUploading: function(uniqueId) {
            if (uniqueId) {
                return this.fileList[uniqueId].status == this.constructor.STATUS_UPLOADING;
            }
            else {
                for (var uId in this.fileList) {
                    if (this.fileList[uId].status == this.constructor.STATUS_UPLOADING) {
                        return true;
                    }
                }

                return false;
            }
        },

        /**
         * Check if the file with the given uniqueId has the status: "COMPLETED".
         *
         * @param uniqueId
         * @returns {boolean}
         */
        isCompleted: function(uniqueId) {
            return this.fileList[uniqueId].status == this.constructor.STATUS_COMPLETED;
        },

        /**
         * Check if the file with the given uniqueId has the status: "FAILED".
         *
         * @param uniqueId
         * @returns {boolean}
         */
        isFailed: function(uniqueId) {
            return this.fileList[uniqueId].status == this.constructor.STATUS_FAILED;
        },

        /**
         * Add a file to the pending list.
         *
         * @param uniqueId
         */
        addToPendingList: function(uniqueId) {
            this.pendingList.push(uniqueId);
        },

        /**
         * Remove a file from the pending list.
         *
         * @param uniqueId
         */
        removeFromPendingList: function(uniqueId) {
            var index = $.inArray(uniqueId, this.pendingList);
            if (index > -1) {
                this.pendingList.splice(index, 1);
            }
        },

        /**
         * Upload the next file from the pending list.
         */
        uploadNext: function() {
            if (this.pendingList.length > 0) {
                this.upload(this.pendingList[0]);
            }
        },

        /**
         * Get the size of the file with the specified unique id.
         * If no unique id is specified, the sum of all file sizes is returned.
         *
         * @param uniqueId
         */
        getBytes: function(uniqueId) {
            if ( ! this.isModernBrowser) {
                return null;
            }

            if (uniqueId) {
                return this.fileList[uniqueId].file.size;
            }
            else {
                var total = 0;
                for (var uId in this.fileList) {
                    total += this.fileList[uId].file.size;
                }

                return total;
            }
        },

        /**
         * Get the number of uploaded bytes for the file with the specified unique id.
         * If no unique id is specified, the sum of all uploaded bytes is returned.
         *
         * @param uniqueId
         */
        getUploadedBytes: function(uniqueId) {
            if ( ! this.isModernBrowser) {
                return null;
            }

            if (uniqueId) {
                return this.isUploading(uniqueId) ? this.fileList[uniqueId].progress.current.bytes : 0;
            }
            else {
                var total = 0;
                for (var uId in this.fileList) {
                    total += this.getUploadedBytes(uId);
                }

                return total;
            }
        },

        /**
         * Get the upload speed (in bytes/sec) of the file with the specified unique id.
         * If no unique id is specified, the overall upload speed is returned.
         *
         * @param uniqueId
         * @param average
         */
        getUploadSpeed: function(uniqueId, average) {
            if ( ! this.isModernBrowser) {
                return null;
            }

            // By default `average` is true
            if (average === undefined) {
                average = true;
            }

            if (uniqueId) {
                var progress = this.fileList[uniqueId].progress;

                if ((progress.current.bytes && progress.current.bytes != this.getBytes(uniqueId))) {
                    if (average) {

                        // Return average upload speed
                        return Math.round(progress.current.bytes / ((progress.current.time - progress.startTime) / 1000));
                    } else {

                        // Return upload speed
                        return Math.round((progress.current.bytes - progress.previous.bytes) / ((progress.current.time - progress.previous.time) / 1000));
                    }
                } else {

                    // Already uploaded
                    return 0;
                }
            }
            else {
                var total = 0;
                for (var uId in this.fileList) {
                    total += this.getUploadSpeed(uId, average);
                }

                return total;
            }
        },

        /**
         * Get the time left (in seconds) until the file with the specified unique id finishes uploading.
         * If no unique id is specified, the time left until all files finish uploading is returned.
         *
         * @param uniqueId
         * @param average
         */
        getTimeLeft: function(uniqueId, average) {
            if ( ! this.isModernBrowser) {
                return null;
            }

            if (uniqueId) {
                return Math.max(Math.ceil((this.getBytes(uniqueId) - this.getUploadedBytes(uniqueId)) / this.getUploadSpeed(uniqueId, average)), 1);
            }
            else {
                var max = 0;
                for (var uId in this.fileList) {
                    max = Math.max(max, this.getTimeLeft(uId, average));
                }

                return max;
            }
        },

        /**
         * Destroy the uploader.
         */
        destroy: function() {

            // Delete all event handlers
            delete this.eventHandlers;

            // Remove the drop zone's event handlers
            if (this.$dropZone) {
                this.$dropZone.off(".Uploader");
            }

            // Abort all uploads in progress
            for (var uniqueId in this.fileList) {
                if (this.fileList[uniqueId].status == this.constructor.STATUS_UPLOADING) {
                    if (this.isModernBrowser) {

                        // This file is uploading via an ajax request. Remove the event handlers of the XHR, before aborting it.
                        this.removeXHREventHandlers(uniqueId);
                    }

                    // Abort the upload
                    this.abort(uniqueId);
                }
            }

            // Delete lists
            delete this.fileList;
            delete this.pendingList;

            // Remove the DOM elements we created
            this.$fileInput.remove();
        },


        // AJAX HELPERS
        // ===============

        /**
         * Upload a file using ajax.
         *
         * @param uniqueId
         */
        ajaxUpload: function(uniqueId) {

            // Create a new request
            var name, xhr = new XMLHttpRequest();

            // Attach event handlers for the xhr
            this.attachXHREventHandlers(xhr, uniqueId);

            // Set xhr as the file's upload request
            this.fileList[uniqueId].request = xhr;

            // We clone `this.options.data` so we can change it without affecting the original object
            var data = $.extend({}, this.options.data);

            // We are ready to upload
            this.onBeforeUpload(uniqueId, this.fileList[uniqueId].name, data, xhr);

            // Create form data
            var formData = new FormData();

            // Add additional data to the form data
            for (name in data) {
                formData.append(name, data[name]);
            }

            // Add the file to the form data
            formData.append(this.options.name, this.fileList[uniqueId].file);

            // Open
            xhr.open(this.options.method, this.options.url, true);

            // Set headers
            xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

            for (name in this.options.headers) {
                xhr.setRequestHeader(name, this.options.headers[name]);
            }

            // Send
            xhr.send(formData);
        },

        /**
         * Abort an ajax request.
         *
         * @param uniqueId
         */
        ajaxAbort: function(uniqueId) {

            // Make sure the file is uploading
            if (this.isUploading(uniqueId)) {
                this.fileList[uniqueId].request.abort();
            }
        },

        /**
         * Attach event handlers to an XHR.
         *
         * @param xhr
         * @param uniqueId
         */
        attachXHREventHandlers: function(xhr, uniqueId) {
            var name = this.fileList[uniqueId].name;

            // Implement event handlers
            var eventHandlers = {
                load: $.proxy(function(e) {
                    this.onUploadComplete(uniqueId, name, e.target.responseText, e.target.status, e.target);
                }, this),

                error: $.proxy(function() {
                    var message = this.errorMessage(this.options.errors.networkError, this.fileList[uniqueId].file);
                    this.onUploadFail(uniqueId, name, message);
                }, this),

                abort: $.proxy(function() {
                    this.onUploadAbort(uniqueId, name);
                }, this),

                progress: $.proxy(function(e) {
                    this.onUploadProgress(uniqueId, name, e.loaded, e.total);
                }, this)
            };

            // Attach event handlers
            xhr.addEventListener("load", eventHandlers.load, false);
            xhr.addEventListener("error", eventHandlers.error, false);
            xhr.addEventListener("abort", eventHandlers.abort, false);
            xhr.upload.addEventListener("progress", eventHandlers.progress, false);

            // Add the object with the event handlers to the xhr (so we can remove them later)
            xhr.eventHandlers = eventHandlers;
        },

        /**
         * Remove all event handlers for an ajax request.
         *
         * @param uniqueId
         */
        removeXHREventHandlers: function(uniqueId) {
            if (this.isUploading(uniqueId)) {
                var xhr = this.fileList[uniqueId].request;

                // Get the event handlers
                var eventHandlers = xhr.eventHandlers;

                // Remove the event handlers
                xhr.removeEventListener("load", eventHandlers.load);
                xhr.removeEventListener("error", eventHandlers.error);
                xhr.removeEventListener("abort", eventHandlers.abort);
                xhr.upload.removeEventListener("progress", eventHandlers.progress);

                // Remove the object with the event handlers from the xhr
                delete xhr.eventHandlers;
            }
        },


        // IFRAME HELPERS
        // ===============

        /**
         * Upload a file using an iFrame.
         *
         * @param uniqueId
         */
        iFrameUpload: function(uniqueId) {

            // Create the hidden form and iFrame
            var form = this.createForm(uniqueId);
            var iFrame = this.createIFrame(uniqueId);

            // Set iFrame as the form's target
            form.attr("target", iFrame.attr("id"));

            // We clone `this.options.data` so we can change it without affecting the original object
            var data = $.extend({}, this.options.data);

            // We are ready to upload
            this.onBeforeUpload(uniqueId, this.fileList[uniqueId].name, data, null);

            // Add additional data to the form
            for (var name in data) {
                $("<input/>", {
                    type: "hidden",
                    name: name,
                    value: data[name]
                }).appendTo(form);
            }

            // Add the file input to the form
            this.fileList[uniqueId].file.appendTo(form);

            // Submit the form
            form.submit();

            // Add the iFrame as the upload request
            this.fileList[uniqueId].request = iFrame;
        },

        /**
         * Abort an upload.
         *
         * @param uniqueId
         */
        iFrameAbort: function(uniqueId) {
            if (this.isUploading(uniqueId)) {

                // Stop the request
                if (window.navigator.userAgent.indexOf("MSIE") > -1) {
                    this.fileList[uniqueId].request[0].contentWindow.document.execCommand("Stop");
                }
                else {
                    this.fileList[uniqueId].request[0].contentWindow.stop();
                }

                // Unbind iFrame onload
                $("#" + uniqueId + "_iframe").off();

                // Call onUploadAbort
                this.onUploadAbort(uniqueId, this.fileList[uniqueId].name);
            }
        },

        /**
         * Create the form for the file.
         */
        createForm: function(uniqueId) {

            // Create the form
            return $("<form/>", {
                enctype: "multipart/form-data",
                method: this.options.method,
                action: this.options.url,
                id: uniqueId + "_form"
            }).css({
                display: "none"
            }).appendTo(document.body);
        },

        /**
         * Create the hidden iFrame to post the form to.
         */
        createIFrame: function(uniqueId) {

            // Create the iFrame
            var iFrame = $("<iframe src='javascript:false;' name='" + uniqueId + "_iframe' id='" + uniqueId + "_iframe'/>").css("display", "none").appendTo(document.body);

            // Listen to iFrame's `onload` event
            iFrame.off().on("load", $.proxy(function() {

                // Get the response from the server in plain text
                this.readIframe(uniqueId, iFrame);
            }, this));

            return iFrame;
        },

        /**
         * Try to read iFrame's content.
         *
         * @param uniqueId
         * @param iFrame
         */
        readIframe: function(uniqueId, iFrame) {
            try {
                // Get the response
                var response = iFrame.contents().find("body").text();

                // Make sure the upload wasn't aborted in meantime
                if (this.isUploading(uniqueId)) {
                    this.onUploadComplete(uniqueId, this.fileList[uniqueId].name, response, null, null);
                }
            }
            catch (error) {
                this.onUploadFail(uniqueId, this.fileList[uniqueId].name, "Something went wrong.");
            }
        },

        /**
         * Remove the hidden form and iFrame from the DOM.
         *
         * @param uniqueId
         */
        iFrameCleanUp: function(uniqueId) {

            // Detach the file input element (we don't want it to be removed with the form)
            this.fileList[uniqueId].file.detach();

            // Use setTimeout to prevent infinite loading in some old browsers
            setTimeout(function() {

                // Remove the form and the iFrame element (if exists)
                $("#" + uniqueId + "_form").remove();
                $("#" + uniqueId + "_iframe").attr("src", "javascript:false;").remove();
            }, 500);
        }
    });

}(window.Uploader, jQuery, window));
