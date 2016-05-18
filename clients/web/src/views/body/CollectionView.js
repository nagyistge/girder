var $                    = require('jquery');
var _                    = require('underscore');
var girder               = require('girder/init');
var Events               = require('girder/events');
var FolderModel          = require('girder/models/FolderModel');
var CollectionModel      = require('girder/models/CollectionModel');
var View                 = require('girder/view');
var HierarchyWidget      = require('girder/views/widgets/HierarchyWidget');
var EditCollectionWidget = require('girder/views/widgets/EditCollectionWidget');
var AccessWidget         = require('girder/views/widgets/AccessWidget');
var MiscFunctions        = require('girder/utilities/MiscFunctions');
var Rest                 = require('girder/utilities/Rest');

require('bootstrap/js/tooltip');

var CollectionPageTemplate = require('girder/templates/body/collectionPage.jade');

/**
 * This view shows a single collection's page.
 */
var CollectionView = View.extend({
    events: {
        'click .g-edit-collection': 'editCollection',
        'click .g-collection-access-control': 'editAccess',
        'click .g-delete-collection': function () {
            MiscFunctions.confirm({
                text: 'Are you sure you want to delete the collection <b>' +
                      this.model.escape('name') + '</b>?',
                yesText: 'Delete',
                escapedHtml: true,
                confirmCallback: _.bind(function () {
                    this.model.destroy().on('g:deleted', function () {
                        Events.trigger('g:alert', {
                            icon: 'ok',
                            text: 'Collection deleted.',
                            type: 'success',
                            timeout: 4000
                        });
                        girder.router.navigate('collections', {trigger: true});
                    });
                }, this)
            });
        }
    },

    initialize: function (settings) {
        Rest.cancelRestRequests('fetch');

        this.upload = settings.upload || false;
        this.access = settings.access || false;
        this.edit = settings.edit || false;
        this.folderAccess = settings.folderAccess || false;
        this.folderCreate = settings.folderCreate || false;
        this.folderEdit = settings.folderEdit || false;
        this.itemCreate = settings.itemCreate || false;

        // If collection model is already passed, there is no need to fetch.
        if (settings.collection) {
            this.model = settings.collection;

            if (settings.folderId) {
                this.folder = new FolderModel();
                this.folder.set({
                    _id: settings.folderId
                }).on('g:fetched', function () {
                    this._createHierarchyWidget();
                    this.render();
                }, this).on('g:error', function () {
                    this.folder = null;
                    this._createHierarchyWidget();
                    this.render();
                }, this).fetch();
            } else {
                this._createHierarchyWidget();
                this.render();
            }
        } else if (settings.id) {
            this.model = new CollectionModel();
            this.model.set('_id', settings.id);

            this.model.on('g:fetched', function () {
                this._createHierarchyWidget();
                this.render();
            }, this).fetch();
        }
    },

    _createHierarchyWidget: function () {
        this.hierarchyWidget = new HierarchyWidget({
            parentModel: this.folder || this.model,
            upload: this.upload,
            folderAccess: this.folderAccess,
            folderEdit: this.folderEdit,
            folderCreate: this.folderCreate,
            itemCreate: this.itemCreate,
            parentView: this
        }).on('g:setCurrentModel', function () {
            // When a user descends into the hierarchy, hide the collection
            // actions list to avoid confusion.
            this.$('.g-collection-header .g-collection-actions-button').hide();
        }, this);
    },

    editCollection: function () {
        var container = $('#g-dialog-container');

        if (!this.editCollectionWidget) {
            this.editCollectionWidget = new EditCollectionWidget({
                el: container,
                model: this.model,
                parentView: this
            }).on('g:saved', function () {
                this.render();
            }, this);
        }
        this.editCollectionWidget.render();
    },

    render: function () {
        this.$el.html(CollectionPageTemplate({
            collection: this.model,
            girder: girder
        }));

        this.hierarchyWidget.setElement(
            this.$('.g-collection-hierarchy-container')).render();

        this.upload = false;
        this.folderAccess = false;
        this.folderEdit = false;
        this.folderCreate = false;
        this.itemCreate = false;

        this.$('.g-collection-actions-button').tooltip({
            container: 'body',
            placement: 'left',
            animation: false,
            delay: {show: 100}
        });

        if (this.edit) {
            this.editCollection();
        } else if (this.access) {
            this.editAccess();
        }

        return this;
    },

    editAccess: function () {
        new AccessWidget({
            el: $('#g-dialog-container'),
            modelType: 'collection',
            model: this.model,
            parentView: this
        }).on('g:accessListSaved', function (params) {
            if (params.recurse) {
                this.hierarchyWidget.refreshFolderList();
            }
        }, this);
    }
});

module.exports = CollectionView;

/**
 * Helper function for fetching the user and rendering the view with
 * an arbitrary set of extra parameters.
 */
var _fetchAndInit = function (collectionId, params) {
    var collection = new CollectionModel();
    collection.set({
        _id: collectionId
    }).on('g:fetched', function () {
        Events.trigger('g:navigateTo', CollectionView, _.extend({
            collection: collection
        }, params || {}));
    }, this).fetch();
};

girder.router.route('collection/:id', 'collectionAccess', function (collectionId, params) {
    _fetchAndInit(collectionId, {
        access: params.dialog === 'access',
        edit: params.dialog === 'edit',
        folderCreate: params.dialog === 'foldercreate',
        dialog: params.dialog
    });
});

girder.router.route('collection/:id/folder/:id', 'collectionFolder',
    function (collectionId, folderId, params) {
        _fetchAndInit(collectionId, {
            folderId: folderId,
            upload: params.dialog === 'upload',
            access: params.dialog === 'access',
            edit: params.dialog === 'edit',
            folderAccess: params.dialog === 'folderaccess',
            folderCreate: params.dialog === 'foldercreate',
            folderEdit: params.dialog === 'folderedit',
            itemCreate: params.dialog === 'itemcreate'
        });
    });
