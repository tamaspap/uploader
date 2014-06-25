/**
 * UploaderJS v0.9.0
 * https://github.com/tamaspap/uploader
 *
 * Copyright 2014, Pap Tamas
 * Released under the MIT license
 * http://www.opensource.org/licenses/MIT
 *
 * Please report issues at: https://github.com/tamaspap/uploader/issues
 */

/**
 * Create the Uploader.
 */
(function ($, window) {

    "use strict";

    /**
     * Create the Uploader class
     *
     * @param options
     */
    function Uploader(options) {
        this.init(options);
    }

    /**
     * Define the static properties of Uploader.
     */
    $.extend(Uploader, {

        /**
         * Default values
         */
        defaults: {

            /**
             * The button to launch the file browser dialog.
             * Possible values: a jQuery selector/object or an HTMLElement.
             */
            selectButton: null,

            /**
             * The drop zone where the user can drag & drop files to.
             * Possible values: a jQuery selector/object or an HTMLElement.
             */
            dropZone: null,

            /**
             * Name of the file input.
             */
            name: "file",

            /**
             * Whether selecting multiple files at once in allowed.
             * Supported only in modern browsers.
             */
            multiple: true,

            /**
             * The url to upload the files to.
             */
            url: null,

            /**
             * Upload method.
             */
            method: "POST",

            /**
             * Whether to automatically upload files after they were selected or drag & dropped to the drop zone.
             */
            autoUpload: true,

            /**
             * Whether to remove the file from the file list if upload failed.
             */
            removeOnFail: true,

            /**
             * Additional headers to send with the files.
             * Supported only in modern browsers.
             */
            headers: {},

            /**
             * Additional data to send with the files.
             */
            data: {},

            /**
             * Array of the accepted file types, ex. [".jpg", ".jpeg", ".png"]. By default all types are accepted.
             */
            acceptType: null,

            /**
             * The accepted file size interval in KB. By default any size is accepted.
             * Supported only in modern browsers.
             */
            acceptSize: [null, null],

            /**
             * The maximum number of files the user can upload. By default there is no limit.
             */
            maxFiles: null,

            /**
             * The maximum number of simultaneous uploads.
             */
            simultaneousUploads: 3,

            /**
             * Whether to upload files using iFrames even if XHR uploads are supported (useful for testing purposes).
             */
            degrade: false,

            /**
             * The css classes that will be added to different elements on different events.
             */
            cssClasses: {

                /**
                 * Drop zone.
                 */
                dropZoneDragOver: "drop-zone-drag-over"
            },

            /**
             * Error messages.
             */
            errors: {
                invalidType:    "The file '{{fileName}}' is not valid. Please upload only files with the following extensions: {{allowedExtensions}}.",
                sizeTooSmall:   "The file '{{fileName}}' is too small. Please upload only files bigger than {{allowedMinSize}}.",
                sizeTooLarge:   "The file '{{fileName}}' is too large. Please upload only files smaller than {{allowedMaxSize}}.",
                tooManyFiles:   "Can not upload the file '{{fileName}}'', because you can upload only {{maxFiles}} file(s).",
                networkError:   "There was a problem uploading the file '{{fileName}}'. Please try uploading that file again."
            },

            /**
             * Prefix to use when creating unique ids.
             */
            uniqueIdPrefix: "upload_"
        },

        /**
         * Counter for generating unique ids.
         */
        uniqueIncrement: 1,

        /**
         * Check browser support for different features.
         */
        support: (function(window) {
            var support = {};

            // Whether the browser supports uploading files with XMLHttpRequest.
            support.xhrUpload = !! window.FormData && !! window.XMLHttpRequest && "upload" in new XMLHttpRequest();

            // Whether the browser supports selecting multiple files at once.
            support.selectMultiple = !! window.FileList && "multiple" in document.createElement("input");

            // Whether the browser supports dropping files to the drop zone.
            var div = document.createElement("div");
            support.dropFiles =  "ondragstart" in div && "ondrop" in div && !! window.FileList;

            return support;
        }(window)),

        /**
         * Define statuses.
         *
         * STATUS_ADDED:        The file was added to the file list.
         * STATUS_UPLOADING:    The file is uploading.
         * STATUS_COMPLETED:    The file is uploaded.
         * STATUS_PENDING:      The file is in the pending list and waits to be uploaded.
         * STATUS_FAILED:       The upload failed due a network error, or the server side validation failed.
         */
        STATUS_ADDED: 		"ADDED",
        STATUS_UPLOADING: 	"UPLOADING",
        STATUS_COMPLETED: 	"COMPLETED",
        STATUS_PENDING: 	"PENDING",
        STATUS_FAILED: 		"FAILED"
    });

    window.Uploader =  Uploader;

}(jQuery, window));
