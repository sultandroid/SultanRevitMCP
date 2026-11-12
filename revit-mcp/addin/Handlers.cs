using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    /// <summary>
    /// Command implementations; all run on Revit's main thread. Every length and coordinate crossing this
    /// boundary is in millimetres (model coordinates relative to the internal origin) so callers never see
    /// Revit's internal decimal feet.
    /// </summary>
    internal static partial class Handlers
    {
        private const double MmPerFoot = 304.8;
        private const int DefaultLimit = 100;
        private const int MaxLimit = 1000;

        private delegate JsonNode Handler(UIApplication app, JsonObject p);

        private static readonly Dictionary<string, Handler> Table = new Dictionary<string, Handler>
        {
            // Read
            ["get_project_info"] = GetProjectInfo,
            ["set_view_display"] = SetViewDisplay,
            ["create_3d_view"] = Create3DView,
            ["set_3d_orientation"] = Set3DOrientation,
            ["create_revision_cloud"] = CreateRevisionCloud,
            ["edit_family_solids"] = EditFamilySolids,
            ["trim_family_solids"] = TrimFamilySolids,
            ["list_documents"] = ListDocuments,
            ["open_document"] = OpenDocument,
            ["activate_document"] = ActivateDocument,
            ["save_document"] = SaveDocument,
            ["close_document"] = CloseDocument,
            ["list_levels"] = ListLevels,
            ["list_views"] = ListViews,
            ["list_element_types"] = ListElementTypes,
            ["query_elements"] = QueryElements,
            ["inspect_cad_geometry"] = InspectCadGeometry,
            ["set_elements_pinned"] = SetElementsPinned,
            ["inspect_datums"] = InspectDatums,
            ["get_element"] = GetElement,
            ["get_selection"] = GetSelection,
            ["get_schedule_data"] = GetScheduleData,
            ["get_view_geometry"] = GetViewGeometry,
            ["export_view_image"] = ExportViewImage,
            // UI
            ["select_elements"] = SelectElements,
            ["open_view"] = OpenView,
            ["create_project"] = CreateProject,
            // Model changes
            ["set_parameter"] = SetParameter,
            ["create_level"] = CreateLevel,
            ["create_grid"] = CreateGrid,
            ["create_wall"] = CreateWall,
            ["ensure_basic_wall_type"] = EnsureBasicWallType,
            ["ensure_slab_type"] = EnsureSlabType,
            ["set_wall_axis"] = SetWallAxis,
            ["ensure_basic_surface_type"] = EnsureBasicSurfaceType,
            ["create_ceiling"] = CreateCeilingSurface,
            ["create_floor_surface"] = CreateFloorSurface,
            ["create_floor"] = CreateFloor,
            ["create_room"] = CreateRoom,
            ["place_family_instance"] = PlaceFamilyInstance,
            ["move_elements"] = MoveElements,
            ["rotate_elements"] = RotateElements,
            ["delete_elements"] = DeleteElements,
            ["create_floor_plan"] = CreateFloorPlan,
            ["create_section"] = CreateSection,
            ["create_sheet"] = CreateSheet,
            ["fit_view_to_sheet"] = FitViewToSheet,
            ["fit_view_crop_to_model"] = FitViewCropToModel,
            ["view_crop_info"] = ViewCropInfo,
            ["list_view_annotations"] = ListViewAnnotations,
            ["set_view_crop"] = SetViewCrop,
            ["set_view_scale"] = SetViewScale,
            ["drawing_info"] = DrawingInfo,
            ["place_view_on_sheet"] = PlaceViewOnSheet,
            ["duplicate_view"] = DuplicateView,
            ["create_detail_lines"] = CreateDetailLines,
            ["create_text_note"] = CreateTextNote,
            ["extend_view_crop"] = ExtendViewCrop,
            ["rotate_view_crop"] = RotateViewCrop,
            ["create_direct_shape"] = CreateDirectShape,
            ["ensure_line_style"] = EnsureLineStyle,
            ["set_curtain_grid"] = SetCurtainGrid,
            ["curtain_grid_probe"] = CurtainGridProbe,
            ["reset_view_isolation"] = ResetViewIsolation,
            ["ensure_text_type"] = EnsureTextType,
            ["load_family"] = LoadFamily,
            ["place_on_face"] = PlaceOnFace,
            ["create_circuit"] = CreateCircuit,
            ["ensure_reference_plane"] = EnsureReferencePlane,
            ["place_on_reference_plane"] = PlaceOnReferencePlane,
            ["ensure_distribution_system"] = EnsureDistributionSystem,
            ["set_view_categories"] = SetViewCategories,
            ["get_electrical_info"] = GetElectricalInfo,
            ["set_panel_system"] = SetPanelSystem,
            ["diagnose_panel"] = DiagnosePanel,
            ["read_panel_schedule"] = ReadPanelSchedule,
            ["scale_panel_schedule"] = ScalePanelSchedule,
            ["clean_electrical_types"] = CleanElectricalTypes,
            ["link_revit_model"] = LinkRevitModel,
            ["set_family_connectors"] = SetFamilyConnectors,
            ["set_view_range"] = SetViewRange,
            ["probe_ray"] = ProbeRay,
            ["create_schedule"] = CreateSchedule,
            ["create_panel_schedule"] = CreatePanelSchedule,
            ["ensure_project_parameters"] = EnsureProjectParameters,
            ["inspect_cut"] = InspectCut,
            ["inspect_family"] = InspectFamily,
            ["family_solid_profiles"] = FamilySolidProfiles,
            ["copy_instance_scaled"] = CopyInstanceScaled,
            ["set_family_material"] = SetFamilyMaterial,
            ["extract_nested_family"] = ExtractNestedFamily,
            ["enable_void_cut"] = EnableVoidCut,
            ["create_void_family"] = CreateVoidFamily,
            ["make_unit_family"] = MakeUnitFamily,
            ["build_title_block"] = BuildTitleBlock,
            ["cut_with_voids"] = CutWithVoids,
            ["ensure_material"] = EnsureMaterial,
            ["set_material_hatch"] = SetMaterialHatch,
            ["rename_materials"] = RenameMaterials,
            ["rename_family"] = RenameFamily,
            ["create_pipe_run"] = CreatePipeRun,
            ["create_duct_run"] = CreateDuctRun,
            ["create_flex_duct"] = CreateFlexDuct,
            ["set_element_type"] = SetElementType,
            ["create_opening"] = CreateOpening,
            ["connect_ducts"] = ConnectDucts,
            ["list_family_text"] = ListFamilyText,
            ["set_family_text"] = SetFamilyText,
            ["add_family_text"] = AddFamilyText,
            ["list_family_images"] = ListFamilyImages,
            ["replace_family_image"] = ReplaceFamilyImage,
            ["list_family_parameters"] = ListFamilyParameters,
            ["bind_shared_parameters"] = BindSharedParameters,
            ["inspect_project_parameter_bindings"] = InspectProjectParameterBindings,
            ["create_text_notes"] = CreateTextNotes,
            ["place_image"] = PlaceImage,
            ["set_family_text_size"] = SetFamilyTextSize,
            ["save_cloud_copy"] = SaveCloudCopy,
            ["import_cad"] = ImportCad,
            ["create_filled_regions"] = CreateFilledRegions,
            ["list_revisions"] = ListRevisions,
            ["list_text_notes"] = ListTextNotes,
            ["set_text_note"] = SetTextNote,
            ["add_titleblock_revision_schedule"] = AddTitleblockRevisionSchedule,
            ["create_revision"] = CreateRevision,
            ["set_sheet_revisions"] = SetSheetRevisions,
            ["create_sheet_list"] = CreateSheetList,
            ["set_schedule_format"] = SetScheduleFormat,
            ["view_category_counts"] = ViewCategoryCounts,
            ["set_view_overrides"] = SetViewOverrides,
            ["set_element_overrides"] = SetElementOverrides,
            ["remove_z_band"] = RemoveZBand,
            ["join_family_solids"] = JoinFamilySolids,
            ["set_viewport_no_title"] = SetViewportNoTitle,
            ["isolate_in_view"] = IsolateInView,
            ["hide_elements"] = HideElementsInView,
            ["isolate_by_mark"] = IsolateByMark,
            ["replace_text"] = ReplaceText,
            ["create_keynote"] = CreateKeynote,
            ["set_family_category"] = SetFamilyCategory,
            ["set_revision_numbering"] = SetRevisionNumbering,
            ["set_revision_sequence"] = SetRevisionSequence,
            ["set_revision_numbering_mode"] = SetRevisionNumberingMode,
            ["paint_element"] = PaintElement,
            ["export_sheets_pdf"] = ExportSheetsPdf,
            ["export_sheets_dwg"] = ExportSheetsDwg,
            ["export_view_dwg"] = ExportViewDwg,
            ["create_dimension_string"] = CreateDimensionString,
            ["tag_elements"] = TagElements,
            ["save_sheet_set"] = SaveSheetSet,
            ["create_drafting_view"] = CreateDraftingView,
            ["create_swatch"] = CreateSwatch,
            ["set_phase_filter"] = SetPhaseFilter,
            ["ensure_view_filter"] = EnsureViewFilter,
            ["load_family_types"] = LoadFamilyTypes,
            ["create_analytical_members"] = CreateAnalyticalMembers,
            ["create_point_supports"] = CreatePointSupports,
            ["create_load_cases"] = CreateLoadCases,
            ["create_line_loads"] = CreateLineLoads,
            ["create_load_combinations"] = CreateLoadCombinations,
            ["list_phases"] = ListPhases,
            ["inspect_link"] = InspectLink,
            ["reload_link"] = ReloadLink,
            ["api_members"] = ApiMembers,
            ["hide_linked_levels"] = HideLinkedLevels,
            ["sheet_browser_info"] = SheetBrowserInfo,
            ["remap_shapes"] = RemapShapes,
            ["acquire_coordinates"] = AcquireCoordinates,
            ["get_shared_coordinates"] = GetSharedCoordinates,
            ["set_shared_coordinates"] = SetSharedCoordinates,
            ["link_cad"] = LinkCad,
            ["move_elements_by"] = MoveElementsBy,
            // Device symbols (Handlers.Symbols.cs)
            // Native rebar (Handlers.Rebar.cs)
            ["create_rebar"] = CreateRebar,
            ["rebar_report"] = RebarReport,
            ["show_rebar_in_view"] = ShowRebarInView,
            ["copy_view_contents"] = CopyViewContents,
            ["copy_views_between_models"] = CopyViewsBetweenModels,
            ["match_view_settings"] = MatchViewSettings,
            ["create_view_like"] = CreateViewLike,
            ["read_view_dimensions"] = ReadViewDimensions,
            ["create_dimensions"] = CreateDimensions,
            ["read_type_parameters"] = ReadTypeParameters,
            ["apply_type_parameters"] = ApplyTypeParameters,
            ["save_family_copy"] = SaveFamilyCopy,
            ["update_revision"] = UpdateRevision,
            ["duplicate_type"] = DuplicateType,
            ["set_dimension_rounding"] = SetDimensionRounding,
            ["create_annotation_symbol"] = CreateAnnotationSymbol,
            ["nest_annotation_in_family"] = NestAnnotationInFamily,
        };

        public static bool Has(string command) => Table.ContainsKey(command);

        // The document a command works on when its params name one ("document": title or full path), so sessions sharing one
        // Revit never have to switch the active model. Commands that need the UI (active view, selection) still use the active one.
        [ThreadStatic] private static string _target;

        public static JsonNode Run(UIApplication app, string command, JsonObject p)
        {
            _target = Str(p, "document");
            try { return Table[command](app, p); }
            finally { _target = null; }
        }

        /// <summary>Sets a view's visual style, such as HLR for black line drawings.</summary>
        private static JsonNode SetViewDisplay(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var style = Enum.TryParse<DisplayStyle>(ReqStr(p, "style"), true, out var parsed) ? parsed : throw new ArgumentException("style must be Wireframe, HLR, Shading, ShadingWithEdges or Realistic.");
            return InTransaction(doc, "Set view display", () =>
            {
                view.DisplayStyle = style;
                return new JsonObject { ["id"] = view.Id.Value, ["style"] = view.DisplayStyle.ToString() };
            });
        }

        // ---- Documents -----------------------------------------------------------------------------

        /// <summary>Returns the error Revit gives when a modal dialog or open transaction blocks the call.</summary>
        private static JsonNode DocumentCall(Func<JsonNode> body)
        {
            try { return body(); }
            catch (Autodesk.Revit.Exceptions.ModificationForbiddenException) { return Failed("Revit is busy — press Esc in Revit and retry."); }
            catch (Autodesk.Revit.Exceptions.InvalidOperationException e) when (IsBusy(e.Message)) { return Failed("Revit is busy — press Esc in Revit and retry."); }
            catch (Autodesk.Revit.Exceptions.ApplicationException e) { return Failed(e.Message); }
        }

        private static bool IsBusy(string message) =>
            message.IndexOf("modal", StringComparison.OrdinalIgnoreCase) >= 0 ||
            message.IndexOf("transaction", StringComparison.OrdinalIgnoreCase) >= 0 ||
            message.IndexOf("busy", StringComparison.OrdinalIgnoreCase) >= 0;

        private static JsonObject Failed(string error) => new JsonObject { ["ok"] = false, ["error"] = error };

        private static string BareTitle(string title) =>
            title.EndsWith(".rvt", StringComparison.OrdinalIgnoreCase) || title.EndsWith(".rfa", StringComparison.OrdinalIgnoreCase)
                ? title.Substring(0, title.Length - 4)
                : title;

        /// <summary>Open host documents with this title. Linked models can be neither activated, saved nor closed.</summary>
        private static List<Document> DocumentsTitled(UIApplication app, string title) =>
            app.Application.Documents.Cast<Document>()
                .Where(d => !d.IsLinked && string.Equals(BareTitle(d.Title), BareTitle(title), StringComparison.OrdinalIgnoreCase))
                .ToList();

        private static JsonNode Candidates(string title, List<Document> found)
        {
            var result = Failed(found.Count == 0 ? $"No open document is titled '{title}'." : $"{found.Count} open documents are titled '{title}'.");
            result["candidates"] = new JsonArray(found.Select(d => (JsonNode)new JsonObject { ["title"] = d.Title, ["path"] = d.PathName }).ToArray());
            return result;
        }

        private static JsonNode ListDocuments(UIApplication app, JsonObject p)
        {
            var active = app.ActiveUIDocument?.Document;
            var documents = new JsonArray();
            foreach (Document d in app.Application.Documents)
                documents.Add(new JsonObject
                {
                    ["title"] = d.Title,
                    ["path"] = d.PathName,
                    ["is_modified"] = d.IsModified,
                    ["is_active"] = active != null && d.Equals(active),
                    ["is_family"] = d.IsFamilyDocument,
                    ["is_linked"] = d.IsLinked,
                });
            return new JsonObject { ["documents"] = documents };
        }

        private static JsonNode OpenDocument(UIApplication app, JsonObject p)
        {
            var path = ReqStr(p, "path");
            if (!System.IO.Path.IsPathRooted(path)) return Failed($"Path must be absolute: {path}");
            if (!System.IO.File.Exists(path)) return Failed($"File not found: {path}");
            // A model with missing links stops on "Unresolved References" and the bridge hangs until someone clicks.
            // Answer it the safe way (Ignore and continue opening; the links stay as they are) and report it.
            var answered = new JsonArray();
            void OnDialog(object s, Autodesk.Revit.UI.Events.DialogBoxShowingEventArgs e)
            {
                if (e is Autodesk.Revit.UI.Events.TaskDialogShowingEventArgs td
                    && td.DialogId.IndexOf("Unresolved_References", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    td.OverrideResult((int)TaskDialogResult.CommandLink2);
                    answered.Add($"{td.DialogId}: ignored and continued opening");
                }
            }
            app.DialogBoxShowing += OnDialog;
            try
            {
                return DocumentCall(() =>
                {
                    var ui = app.OpenAndActivateDocument(path);
                    var doc = ui?.Document ?? throw new InvalidOperationException(
                        "Revit did not open it. If it is linked into an open model, close that model first.");
                    var r = new JsonObject { ["ok"] = true, ["title"] = doc.Title, ["path"] = doc.PathName, ["is_modified"] = doc.IsModified };
                    if (answered.Count > 0) r["dialogs_answered"] = answered.DeepClone();
                    return r;
                });
            }
            finally { app.DialogBoxShowing -= OnDialog; }
        }

        private static JsonNode ActivateDocument(UIApplication app, JsonObject p)
        {
            var title = ReqStr(p, "title");
            var found = DocumentsTitled(app, title);
            if (found.Count != 1) return Candidates(title, found);
            var doc = found[0];
            var active = app.ActiveUIDocument?.Document;
            if (active != null && doc.Equals(active))
                return new JsonObject { ["ok"] = true, ["title"] = doc.Title, ["active_view"] = app.ActiveUIDocument.ActiveView?.Name, ["is_modified"] = doc.IsModified, ["note"] = "already active" };
            if (string.IsNullOrEmpty(doc.PathName)) return Failed($"'{doc.Title}' has never been saved, so Revit cannot activate it by path.");
            return DocumentCall(() =>
            {
                var ui = app.OpenAndActivateDocument(doc.PathName);
                return new JsonObject { ["ok"] = true, ["title"] = ui.Document.Title, ["active_view"] = ui.ActiveView?.Name, ["is_modified"] = ui.Document.IsModified };
            });
        }

        private static JsonNode SaveDocument(UIApplication app, JsonObject p)
        {
            var title = Str(p, "title");
            Document doc;
            if (title == null) doc = Doc(app);
            else
            {
                var found = DocumentsTitled(app, title);
                if (found.Count != 1) return Candidates(title, found);
                doc = found[0];
            }
            var saveAs = Str(p, "path");
            return DocumentCall(() =>
            {
                if (saveAs != null)
                {
                    if (!System.IO.Path.IsPathRooted(saveAs)) return Failed($"Path must be absolute: {saveAs}");
                    doc.SaveAs(saveAs);
                    return new JsonObject { ["ok"] = true, ["title"] = doc.Title, ["path"] = doc.PathName, ["saved"] = true, ["is_modified"] = doc.IsModified };
                }
                if (string.IsNullOrEmpty(doc.PathName)) return Failed($"'{doc.Title}' has never been saved. Pass a path.");
                if (!doc.IsModified) return new JsonObject { ["ok"] = true, ["title"] = doc.Title, ["path"] = doc.PathName, ["saved"] = false, ["reason"] = "not modified", ["is_modified"] = false };
                doc.Save();
                return new JsonObject { ["ok"] = true, ["title"] = doc.Title, ["path"] = doc.PathName, ["saved"] = true, ["is_modified"] = doc.IsModified };
            });
        }

        private static JsonNode CloseDocument(UIApplication app, JsonObject p)
        {
            var title = Str(p, "title");
            var save = p["save"]?.GetValue<bool>() ?? true;
            var allowLast = p["allow_last"]?.GetValue<bool>() ?? false;
            Document doc;
            if (title == null) doc = Doc(app);
            else
            {
                var found = DocumentsTitled(app, title);
                if (found.Count != 1) return Candidates(title, found);
                doc = found[0];
            }
            var others = app.Application.Documents.Cast<Document>().Where(d => !d.IsLinked && !d.Equals(doc)).ToList();
            if (others.Count == 0 && !allowLast) return Failed($"'{doc.Title}' is the last open document. Pass allow_last to close it.");
            return DocumentCall(() =>
            {
                if (save && doc.IsModified)
                {
                    if (string.IsNullOrEmpty(doc.PathName)) return Failed($"'{doc.Title}' has never been saved, so it was not closed.");
                    doc.Save();
                }
                // Revit refuses to close the active document, so another one has to come forward first.
                var active = app.ActiveUIDocument?.Document;
                if (active != null && doc.Equals(active))
                {
                    var next = others.FirstOrDefault(d => !string.IsNullOrEmpty(d.PathName));
                    if (next == null) return Failed($"Revit cannot close the active document '{doc.Title}' through the API while no other saved document is open. It was saved if requested, and left open.");
                    app.OpenAndActivateDocument(next.PathName);
                }
                doc.Close(false);
                var remaining = app.Application.Documents.Cast<Document>().Count(d => !d.IsLinked);
                var result = new JsonObject { ["ok"] = true, ["closed"] = true, ["remaining"] = remaining };
                if (app.ActiveUIDocument == null) result["note"] = "No document is active now.";
                return result;
            });
        }

        // ---- Read ----------------------------------------------------------------------------------

        private static JsonNode GetProjectInfo(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var info = doc.ProjectInformation;
            return new JsonObject
            {
                ["title"] = doc.Title,
                ["path"] = doc.PathName,
                ["is_family_document"] = doc.IsFamilyDocument,
                ["is_workshared"] = doc.IsWorkshared,
                ["is_modified"] = doc.IsModified,
                ["revit_version"] = app.Application.VersionNumber,
                ["active_view"] = app.ActiveUIDocument.ActiveView?.Name,
                ["project_name"] = info?.Name,
                ["project_number"] = info?.Number,
                ["client_name"] = info?.ClientName,
                ["address"] = info?.Address,
                ["building_name"] = info?.BuildingName,
                ["status"] = info?.Status,
                ["issue_date"] = info?.IssueDate,
            };
        }

        private static JsonNode ListLevels(UIApplication app, JsonObject p)
        {
            var levels = new FilteredElementCollector(Doc(app)).OfClass(typeof(Level)).Cast<Level>()
                .OrderBy(l => l.Elevation)
                .Select(l => (JsonNode)new JsonObject
                {
                    ["id"] = l.Id.Value,
                    ["name"] = l.Name,
                    ["elevation_mm"] = ToMm(l.Elevation),
                });
            return new JsonObject { ["levels"] = new JsonArray(levels.ToArray()) };
        }

        private static JsonNode ListViews(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var typeFilter = Str(p, "view_type");
            var activeId = app.ActiveUIDocument.ActiveView?.Id;
            var views = new FilteredElementCollector(doc).OfClass(typeof(View)).Cast<View>()
                .Where(v => !v.IsTemplate)
                .Where(v => typeFilter == null || v.ViewType.ToString().Equals(typeFilter, StringComparison.OrdinalIgnoreCase))
                .OrderBy(v => v.ViewType.ToString()).ThenBy(v => v.Name)
                .Select(v => (JsonNode)new JsonObject
                {
                    ["id"] = v.Id.Value,
                    ["name"] = v.Name,
                    ["view_type"] = v.ViewType.ToString(),
                    ["level"] = v.GenLevel?.Name,
                    ["is_active"] = v.Id == activeId,
                });
            return new JsonObject { ["views"] = new JsonArray(views.ToArray()) };
        }

        private static JsonNode ListElementTypes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var collector = new FilteredElementCollector(doc).WhereElementIsElementType();
            var category = Str(p, "category");
            if (category != null) collector.OfCategoryId(ResolveCategory(doc, category).Id);

            var family = Str(p, "family");
            var matches = collector.Cast<ElementType>()
                .Where(t => family == null || Contains(t.FamilyName, family))
                .OrderBy(t => t.FamilyName).ThenBy(t => t.Name);
            return Page(matches, p, "types", t => new JsonObject
            {
                ["id"] = t.Id.Value,
                ["family"] = t.FamilyName,
                ["name"] = t.Name,
                ["category"] = t.Category?.Name,
            });
        }

        private static JsonNode QueryElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewId = OptId(p, "view_id");
            var collector = viewId != null ? new FilteredElementCollector(doc, viewId) : new FilteredElementCollector(doc);
            collector.WhereElementIsNotElementType();

            var category = Str(p, "category");
            if (category != null) collector.OfCategoryId(ResolveCategory(doc, category).Id);

            IEnumerable<Element> matches = collector.Where(e => e.Category != null);

            var levelId = OptId(p, "level_id");
            if (levelId != null) matches = matches.Where(e => OnLevel(e, levelId));

            var parameterName = Str(p, "parameter_name");
            if (parameterName != null)
            {
                var parameterValue = Str(p, "parameter_value");
                matches = matches.Where(e =>
                {
                    var param = e.LookupParameter(parameterName);
                    if (param == null) return false;
                    return parameterValue == null || Contains(DisplayValue(doc, param) ?? "", parameterValue);
                });
            }

            return Page(matches, p, "elements", e => Summary(doc, e));
        }

        private static JsonNode GetElement(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var element = RequireElement(doc, ReqId(p, "element_id"));
            var result = Summary(doc, element);

            var elementType = element.GetTypeId() == ElementId.InvalidElementId ? null : doc.GetElement(element.GetTypeId());
            if (elementType != null)
            {
                result["type_id"] = elementType.Id.Value;
                result["type_name"] = elementType.Name;
            }

            result["parameters"] = ParametersOf(doc, element);
            if (element is ReferencePlane plane)
                result["reference_plane"] = new JsonObject
                {
                    ["bubble_end"] = PointJson(plane.BubbleEnd),
                    ["free_end"] = PointJson(plane.FreeEnd),
                    ["normal"] = DirectionJson(plane.Normal),
                };
            if (Bool(p, "include_type_parameters") && doc.GetElement(element.GetTypeId()) is Element type)
                result["type_parameters"] = ParametersOf(doc, type);

            var box = element.get_BoundingBox(null);
            if (box != null)
                result["bounding_box"] = new JsonObject { ["min"] = PointJson(box.Min), ["max"] = PointJson(box.Max) };
            return result;
        }

        private static JsonNode GetSelection(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var elements = app.ActiveUIDocument.Selection.GetElementIds().Select(doc.GetElement).Where(e => e != null);
            return Page(elements, p, "elements", e => Summary(doc, e));
        }

        private static JsonNode GetScheduleData(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            if (!(RequireElement(doc, ReqId(p, "view_id")) is ViewSchedule schedule))
                throw new ArgumentException("view_id is not a schedule view.");

            var body = schedule.GetTableData().GetSectionData(SectionType.Body);
            var limit = Limit(p);
            var rows = new JsonArray();
            for (var r = 0; r < body.NumberOfRows && r < limit; r++)
            {
                var row = new JsonArray();
                for (var c = 0; c < body.NumberOfColumns; c++)
                    row.Add(schedule.GetCellText(SectionType.Body, r, c));
                rows.Add(row);
            }
            return new JsonObject
            {
                ["name"] = schedule.Name,
                ["total_rows"] = body.NumberOfRows,
                ["rows"] = rows,
            };
        }

        private static JsonNode GetViewGeometry(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, OptId(p, "view_id") ?? app.ActiveUIDocument.ActiveView.Id) as View
                       ?? throw new ArgumentException("view_id is not a view.");
            var result = new JsonObject
            {
                ["id"] = view.Id.Value,
                ["name"] = view.Name,
                ["origin"] = PointJson(view.Origin),
                ["right_direction"] = DirectionJson(view.RightDirection),
                ["up_direction"] = DirectionJson(view.UpDirection),
                ["view_direction"] = DirectionJson(view.ViewDirection),
                ["crop_box_active"] = view.CropBoxActive,
            };
            var crop = view.CropBox;
            if (crop != null)
                result["crop_box"] = new JsonObject
                {
                    ["min"] = PointJson(crop.Transform.OfPoint(crop.Min)),
                    ["max"] = PointJson(crop.Transform.OfPoint(crop.Max)),
                };
            return result;
        }

        private static JsonNode ExportViewImage(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewId = OptId(p, "view_id") ?? app.ActiveUIDocument.ActiveView.Id;
            var view = RequireElement(doc, viewId) as View ?? throw new ArgumentException("view_id is not a view.");

            // ExportImage chooses its own file name from the view name, so give it an empty folder.
            var dir = Path.Combine(Path.GetTempPath(), "RevitMcp", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                var options = new ImageExportOptions
                {
                    ZoomType = ZoomFitType.FitToPage,
                    PixelSize = (int)(Num(p, "pixel_size") ?? 1600),
                    FitDirection = FitDirectionType.Horizontal,
                    ImageResolution = ImageResolution.DPI_150,
                    ExportRange = ExportRange.SetOfViews,
                    HLRandWFViewsFileType = ImageFileType.PNG,
                    ShadowViewsFileType = ImageFileType.PNG,
                    FilePath = Path.Combine(dir, "view"),
                };
                options.SetViewsAndSheets(new List<ElementId> { view.Id });
                doc.ExportImage(options);

                var file = Directory.GetFiles(dir, "*.png").FirstOrDefault()
                           ?? throw new InvalidOperationException($"Revit produced no image for view '{view.Name}'.");
                return new JsonObject
                {
                    ["view"] = view.Name,
                    ["mime_type"] = "image/png",
                    ["data_base64"] = Convert.ToBase64String(File.ReadAllBytes(file)),
                };
            }
            finally
            {
                Directory.Delete(dir, true);
            }
        }

        // ---- UI ------------------------------------------------------------------------------------

        private static JsonNode SelectElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "element_ids");
            foreach (var id in ids) RequireElement(doc, id);

            var ui = app.ActiveUIDocument;
            ui.Selection.SetElementIds(ids);
            if (Bool(p, "zoom_to") && ids.Count > 0) ui.ShowElements(ids);
            return new JsonObject { ["selected"] = ids.Count };
        }

        private static JsonNode OpenView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            app.ActiveUIDocument.ActiveView = view;
            return new JsonObject { ["active_view"] = view.Name };
        }

        private static JsonNode CreateProject(UIApplication app, JsonObject p)
        {
            var path = ReqStr(p, "path");
            if (!Path.IsPathFullyQualified(path) || !path.EndsWith(".rvt", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("path must be a full path ending in .rvt.");
            if (File.Exists(path)) throw new ArgumentException($"'{path}' already exists and will not be overwritten.");

            var template = Str(p, "template_path") ?? app.Application.DefaultProjectTemplate;
            if (string.IsNullOrEmpty(template) || !File.Exists(template))
                throw new ArgumentException($"Template not found: '{template}'. Pass template_path.");

            // The API can only show a document that exists on disk, so a new project has to be saved first.
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var doc = app.Application.NewProjectDocument(template);
            doc.SaveAs(path);
            // Close the hidden in-memory copy first: opening a path that is already open in the session
            // can stall on a dialog.
            doc.Close(false);
            var opened = app.OpenAndActivateDocument(path);
            return new JsonObject
            {
                ["title"] = opened.Document.Title,
                ["path"] = opened.Document.PathName,
                ["template"] = template,
            };
        }

        // ---- Model changes -------------------------------------------------------------------------

        private static JsonNode SetParameter(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            if (p["element_ids"] is JsonArray many) return SetParameterMany(doc, p, many);
            var element = RequireElement(doc, ReqId(p, "element_id"));
            var name = ReqStr(p, "parameter_name");

            // Writing to a type changes every instance of it, so the caller has to ask for that explicitly.
            var target = Bool(p, "on_type")
                ? doc.GetElement(element.GetTypeId()) ?? throw new ArgumentException("Element has no type.")
                : element;
            var parameter = target.LookupParameter(name)
                            ?? throw new ArgumentException($"'{target.Name}' has no parameter '{name}'.");
            if (parameter.IsReadOnly) throw new InvalidOperationException($"Parameter '{name}' is read-only.");

            var value = p["value"] ?? throw new ArgumentException("value is required.");
            return InTransaction(doc, $"Set {name}", () =>
            {
                ApplyValue(parameter, value);
                return new JsonObject
                {
                    ["element_id"] = target.Id.Value,
                    ["parameter"] = name,
                    ["value"] = DisplayValue(doc, parameter),
                };
            });
        }

        /// <summary>
        /// The same instance parameter on many elements, in one undo step. Elements that lack the parameter,
        /// have it read-only, or reject the value are skipped and listed, so one bad element does not undo the rest.
        /// </summary>
        private static JsonNode SetParameterMany(Document doc, JsonObject p, JsonArray ids)
        {
            var name = ReqStr(p, "parameter_name");
            if (Bool(p, "on_type")) throw new ArgumentException("on_type is not supported with element_ids.");
            var value = p["value"] ?? throw new ArgumentException("value is required.");
            return InTransaction(doc, $"Set {name} on {ids.Count} elements", () =>
            {
                int done = 0;
                var skipped = new JsonArray();
                foreach (var node in ids)
                {
                    var id = new ElementId(node.GetValue<long>());
                    var element = doc.GetElement(id);
                    var parameter = element?.LookupParameter(name);
                    string why = element == null ? "no such element"
                        : parameter == null ? "no such parameter"
                        : parameter.IsReadOnly ? "read-only" : null;
                    if (why == null)
                    {
                        try { ApplyValue(parameter, value); done++; }
                        catch (Exception ex) { why = ex.Message; }
                    }
                    if (why != null) skipped.Add(new JsonObject { ["element_id"] = id.Value, ["reason"] = why });
                }
                return new JsonObject { ["parameter"] = name, ["set"] = done, ["skipped"] = skipped };
            });
        }

        private static void ApplyValue(Parameter parameter, JsonNode value)
        {
            var text = value.ToString();
            bool ok;
            switch (parameter.StorageType)
            {
                case StorageType.String:
                    ok = parameter.Set(text);
                    break;
                case StorageType.Integer:
                    ok = parameter.Set(ParseInteger(text));
                    break;
                case StorageType.ElementId:
                    ok = parameter.Set(new ElementId(long.Parse(text)));
                    break;
                case StorageType.Double:
                    // A plain number is in the parameter's display units; a string such as "3000 mm" states its own.
                    ok = double.TryParse(text, System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture, out var number)
                        ? parameter.Set(ToInternal(parameter, number))
                        : parameter.SetValueString(text);
                    break;
                default:
                    throw new InvalidOperationException($"Parameter '{parameter.Definition.Name}' cannot store a value.");
            }
            if (!ok) throw new InvalidOperationException($"Revit rejected value '{text}' for '{parameter.Definition.Name}'.");
        }

        private static int ParseInteger(string text)
        {
            if (bool.TryParse(text, out var flag)) return flag ? 1 : 0;
            return int.Parse(text);
        }

        private static double ToInternal(Parameter parameter, double value)
        {
            return UnitUtils.IsMeasurableSpec(parameter.Definition.GetDataType())
                ? UnitUtils.ConvertToInternalUnits(value, parameter.GetUnitTypeId())
                : value;
        }

        private static JsonNode CreateLevel(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var elevation = FromMm(ReqNum(p, "elevation_mm"));
            var name = Str(p, "name");
            return InTransaction(doc, "Create level", () =>
            {
                var level = Level.Create(doc, elevation);
                if (name != null) level.Name = name;
                return new JsonObject { ["id"] = level.Id.Value, ["name"] = level.Name };
            });
        }

        private static JsonNode CreateGrid(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var line = Line.CreateBound(ReqPoint(p, "start"), ReqPoint(p, "end"));
            var name = Str(p, "name");
            return InTransaction(doc, "Create grid", () =>
            {
                var grid = Grid.Create(doc, line);
                if (name != null) grid.Name = name;
                return new JsonObject { ["id"] = grid.Id.Value, ["name"] = grid.Name };
            });
        }

        private static JsonNode CreateWall(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var line = Line.CreateBound(ReqPoint(p, "start"), ReqPoint(p, "end"));
            var typeId = OptId(p, "wall_type_id") ?? doc.GetDefaultElementTypeId(ElementTypeGroup.WallType);
            var height = FromMm(Num(p, "height_mm") ?? 3000);
            var baseOffset = FromMm(Num(p, "base_offset_mm") ?? 0);
            var structural = Bool(p, "structural");
            return InTransaction(doc, "Create wall", () =>
            {
                var wall = Wall.Create(doc, line, typeId, level.Id, height, baseOffset, false, structural);
                return new JsonObject { ["id"] = wall.Id.Value, ["type"] = wall.Name };
            });
        }

        private static JsonNode CreateFloor(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var points = (p["boundary"] as JsonArray ?? throw new ArgumentException("boundary is required."))
                .Select(ToPoint).ToList();
            if (points.Count < 3) throw new ArgumentException("boundary needs at least 3 points.");

            var loop = new CurveLoop();
            for (var i = 0; i < points.Count; i++)
                loop.Append(Line.CreateBound(points[i], points[(i + 1) % points.Count]));

            var typeId = OptId(p, "floor_type_id") ?? Floor.GetDefaultFloorType(doc, false);
            return InTransaction(doc, "Create floor", () =>
            {
                var floor = Floor.Create(doc, new List<CurveLoop> { loop }, typeId, level.Id);
                return new JsonObject { ["id"] = floor.Id.Value, ["type"] = floor.Name };
            });
        }

        private static JsonNode CreateRoom(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var location = ReqPoint(p, "location");
            var name = Str(p, "name");
            var number = Str(p, "number");
            return InTransaction(doc, "Create room", () =>
            {
                var room = doc.Create.NewRoom(level, new UV(location.X, location.Y));
                if (name != null) room.Name = name;
                if (number != null) room.Number = number;
                return new JsonObject { ["id"] = room.Id.Value, ["name"] = room.Name, ["number"] = room.Number };
            });
        }

        private static JsonNode PlaceFamilyInstance(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var symbol = RequireElement(doc, ReqId(p, "family_type_id")) as FamilySymbol
                         ?? throw new ArgumentException("family_type_id is not a loadable family type.");
            var location = ReqPoint(p, "location");
            var host = OptId(p, "host_id") is ElementId hostId ? RequireElement(doc, hostId) : null;

            var levelId = OptId(p, "level_id") ?? host?.LevelId;
            if (levelId == null || levelId == ElementId.InvalidElementId)
                throw new ArgumentException("level_id is required unless the host element has a level.");
            var level = RequireLevel(doc, levelId);

            var structuralType = Enum.TryParse<StructuralType>(Str(p, "structural_type") ?? "NonStructural", true, out var parsed)
                ? parsed
                : throw new ArgumentException("structural_type must be NonStructural, Beam, Brace, Column or Footing.");
            var rotation = Num(p, "rotation_deg") ?? 0;

            return InTransaction(doc, $"Place {symbol.Name}", () =>
            {
                if (!symbol.IsActive)
                {
                    symbol.Activate();
                    doc.Regenerate();
                }
                var instance = host != null
                    ? doc.Create.NewFamilyInstance(location, symbol, host, level, structuralType)
                    : doc.Create.NewFamilyInstance(location, symbol, level, structuralType);
                if (rotation != 0)
                {
                    var axis = Line.CreateBound(location, location + XYZ.BasisZ);
                    ElementTransformUtils.RotateElement(doc, instance.Id, axis, rotation * Math.PI / 180);
                }
                return new JsonObject { ["id"] = instance.Id.Value, ["family"] = symbol.FamilyName, ["type"] = symbol.Name };
            });
        }

        private static JsonNode MoveElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "element_ids");
            var delta = new XYZ(FromMm(Num(p, "dx_mm") ?? 0), FromMm(Num(p, "dy_mm") ?? 0), FromMm(Num(p, "dz_mm") ?? 0));
            return InTransaction(doc, "Move elements", () =>
            {
                ElementTransformUtils.MoveElements(doc, ids, delta);
                return new JsonObject { ["moved"] = ids.Count };
            });
        }

        /// <summary>Turns elements about a vertical axis: through "center" {x,y} (mm) when given, else each about its own
        /// location point. Keeps the element itself (circuits, tags and hosts stay), unlike placing a new turned copy.</summary>
        private static JsonNode RotateElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "element_ids");
            var angle = (Num(p, "angle_deg") ?? throw new ArgumentException("angle_deg is required.")) * Math.PI / 180;
            XYZ center = p["center"] is JsonObject ? ReqPoint(p, "center") : null;
            return InTransaction(doc, "Rotate elements", () =>
            {
                var done = new JsonArray();
                foreach (var id in ids)
                {
                    var e = RequireElement(doc, id);
                    var at = center ?? (e.Location as LocationPoint)?.Point ?? (e.Location as LocationCurve)?.Curve.Evaluate(0.5, true)
                             ?? throw new ArgumentException($"{id.Value} has no location point; pass center.");
                    ElementTransformUtils.RotateElement(doc, id, Line.CreateBound(at, at + XYZ.BasisZ), angle);
                    done.Add(id.Value);
                }
                return new JsonObject { ["rotated"] = done };
            });
        }

        private static JsonNode DeleteElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "element_ids");
            return InTransaction(doc, "Delete elements", () =>
            {
                // Revit also deletes dependants (a wall's doors, for example), so report the full set.
                var deleted = doc.Delete(ids);
                return new JsonObject
                {
                    ["requested"] = ids.Count,
                    ["deleted_total"] = deleted.Count,
                    ["deleted_ids"] = new JsonArray(deleted.Select(id => (JsonNode)id.Value).ToArray()),
                };
            });
        }

        private static JsonNode CreateFloorPlan(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var name = Str(p, "name");
            // ceiling: true makes a reflected ceiling plan instead.
            var family = p["ceiling"]?.GetValue<bool>() == true ? ViewFamily.CeilingPlan : ViewFamily.FloorPlan;
            var viewType = new FilteredElementCollector(doc).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>()
                               .FirstOrDefault(t => t.ViewFamily == family)
                           ?? throw new InvalidOperationException($"This model has no {family} view type.");
            return InTransaction(doc, "Create plan view", () =>
            {
                var view = ViewPlan.Create(doc, viewType.Id, level.Id);
                if (name != null) view.Name = name;
                return new JsonObject { ["id"] = view.Id.Value, ["name"] = view.Name };
            });
        }

        private static JsonNode CreateSection(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var start = ReqPoint(p, "start");
            var end = ReqPoint(p, "end");
            var look = ReqPoint(p, "look_direction");
            look = new XYZ(look.X, look.Y, 0);
            var along = new XYZ(end.X - start.X, end.Y - start.Y, 0);
            if (along.IsZeroLength() || look.IsZeroLength()) throw new ArgumentException("start, end and look_direction must be horizontal and non-zero.");
            look = look.Normalize();
            if (Math.Abs(along.Normalize().DotProduct(look)) > 1e-6) throw new ArgumentException("look_direction must be perpendicular to the line from start to end.");
            var bottom = FromMm(ReqNum(p, "bottom_mm"));
            var top = FromMm(ReqNum(p, "top_mm"));
            var depth = FromMm(ReqNum(p, "depth_mm"));
            if (top <= bottom || depth <= 0) throw new ArgumentException("top_mm must be above bottom_mm and depth_mm must be positive.");
            var name = Str(p, "name");
            var scale = Num(p, "scale");
            var viewType = new FilteredElementCollector(doc).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>()
                               .FirstOrDefault(t => t.ViewFamily == ViewFamily.Section)
                           ?? throw new InvalidOperationException("This model has no section view type.");

            // The cut plane is at Min.Z and the view looks along BasisZ, so the box runs from the line in look_direction.
            var transform = Transform.Identity;
            transform.Origin = new XYZ((start.X + end.X) / 2, (start.Y + end.Y) / 2, 0);
            transform.BasisY = XYZ.BasisZ;
            transform.BasisZ = look;
            transform.BasisX = transform.BasisY.CrossProduct(transform.BasisZ);
            var halfWidth = along.GetLength() / 2;
            var box = new BoundingBoxXYZ
            {
                Transform = transform,
                Min = new XYZ(-halfWidth, bottom, 0),
                Max = new XYZ(halfWidth, top, depth),
            };
            return InTransaction(doc, "Create section", () =>
            {
                var view = ViewSection.CreateSection(doc, viewType.Id, box);
                if (name != null) view.Name = name;
                if (scale != null) view.Scale = (int)scale.Value;
                return new JsonObject
                {
                    ["id"] = view.Id.Value,
                    ["name"] = view.Name,
                    ["view_direction"] = new JsonArray(view.ViewDirection.X, view.ViewDirection.Y, view.ViewDirection.Z),
                    ["origin_mm"] = new JsonArray(view.Origin.X * MmPerFoot, view.Origin.Y * MmPerFoot, view.Origin.Z * MmPerFoot),
                };
            });
        }

        private static JsonNode CreateSheet(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var titleBlockId = OptId(p, "title_block_type_id")
                               ?? new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_TitleBlocks)
                                   .WhereElementIsElementType().FirstElementId();
            var number = Str(p, "number");
            var name = Str(p, "name");
            return InTransaction(doc, "Create sheet", () =>
            {
                var sheet = ViewSheet.Create(doc, titleBlockId);
                if (number != null) sheet.SheetNumber = number;
                if (name != null) sheet.Name = name;
                return new JsonObject { ["id"] = sheet.Id.Value, ["number"] = sheet.SheetNumber, ["name"] = sheet.Name };
            });
        }

        private static JsonNode PlaceViewOnSheet(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var sheet = RequireElement(doc, ReqId(p, "sheet_id")) as ViewSheet ?? throw new ArgumentException("sheet_id is not a sheet.");
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var location = ReqPoint(p, "location");
            return InTransaction(doc, "Place view on sheet", () =>
            {
                // Schedules are placed through a different API from other views.
                if (view is ViewSchedule)
                {
                    var instance = ScheduleSheetInstance.Create(doc, sheet.Id, view.Id, location);
                    return new JsonObject { ["id"] = instance.Id.Value };
                }
                // Panel schedules are table views too, with their own sheet instance.
                if (view is Autodesk.Revit.DB.Electrical.PanelScheduleView)
                {
                    var instance = Autodesk.Revit.DB.Electrical.PanelScheduleSheetInstance.Create(doc, view.Id, sheet);
                    instance.Origin = location;
                    return new JsonObject { ["id"] = instance.Id.Value };
                }
                if (!Viewport.CanAddViewToSheet(doc, sheet.Id, view.Id))
                    throw new InvalidOperationException($"View '{view.Name}' cannot be placed; it may already be on a sheet.");
                var viewport = Viewport.Create(doc, sheet.Id, view.Id, location)
                    ?? throw new InvalidOperationException($"Revit made no viewport for '{view.Name}'; an empty view cannot be placed on a sheet.");
                return new JsonObject { ["id"] = viewport.Id.Value };
            });
        }

        private static JsonNode DuplicateView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var name = Str(p, "name");
            var option = Enum.TryParse<ViewDuplicateOption>(Str(p, "option") ?? "WithDetailing", true, out var parsed)
                ? parsed
                : throw new ArgumentException("option must be Duplicate, WithDetailing or AsDependent.");
            if (!view.CanViewBeDuplicated(option))
                throw new InvalidOperationException($"View '{view.Name}' cannot be duplicated with option {option}.");

            return InTransaction(doc, $"Duplicate {view.Name}", () =>
            {
                var copy = (View)doc.GetElement(view.Duplicate(option));
                if (name != null) copy.Name = name;
                return new JsonObject { ["id"] = copy.Id.Value, ["name"] = copy.Name };
            });
        }

        private static JsonNode CreateDetailLines(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            // Each item is a line {start, end}, or a true arc {start, end, mid} through the three points.
            var lines = (p["lines"] as JsonArray ?? throw new ArgumentException("lines is required."))
                .Select(n =>
                {
                    var o = n.AsObject();
                    var a = OnViewPlane(view, ReqPoint(o, "start"));
                    var b = OnViewPlane(view, ReqPoint(o, "end"));
                    return o["mid"] is JsonObject ? (Curve)Arc.Create(a, b, OnViewPlane(view, ReqPoint(o, "mid"))) : Line.CreateBound(a, b);
                })
                .ToList();
            if (lines.Count == 0) throw new ArgumentException("lines needs at least 1 line.");
            var styleName = Str(p, "line_style");
            var style = styleName == null ? null : LineStyleByName(doc, styleName);

            return InTransaction(doc, "Create detail lines", () =>
            {
                var created = lines.Select(line =>
                {
                    var curve = doc.Create.NewDetailCurve(view, line);
                    if (style != null) curve.LineStyle = style;
                    return (JsonNode)curve.Id.Value;
                }).ToArray();
                return new JsonObject { ["created"] = created.Length, ["ids"] = new JsonArray(created) };
            });
        }

        private static GraphicsStyle LineStyleByName(Document doc, string name)
        {
            var lines = doc.Settings.Categories.get_Item(BuiltInCategory.OST_Lines);
            if (!lines.SubCategories.Contains(name)) throw new ArgumentException($"No line style named '{name}'.");
            return lines.SubCategories.get_Item(name).GetGraphicsStyle(GraphicsStyleType.Projection);
        }

        private static Color ColorOf(JsonObject p, string key)
        {
            var c = p[key]?.AsObject() ?? throw new ArgumentException($"{key} is required.");
            return new Color((byte)ReqNum(c, "r"), (byte)ReqNum(c, "g"), (byte)ReqNum(c, "b"));
        }

        private static JsonNode EnsureLineStyle(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var weight = (int)ReqNum(p, "weight");
            var color = ColorOf(p, "color");
            var patternName = Str(p, "pattern");
            var pattern = patternName == null
                ? null
                : LinePatternElement.GetLinePatternElementByName(doc, patternName)
                  ?? throw new ArgumentException($"No line pattern named '{patternName}'.");

            return InTransaction(doc, $"Line style {name}", () =>
            {
                var lines = doc.Settings.Categories.get_Item(BuiltInCategory.OST_Lines);
                var style = lines.SubCategories.Contains(name)
                    ? lines.SubCategories.get_Item(name)
                    : doc.Settings.Categories.NewSubcategory(lines, name);
                style.LineColor = color;
                style.SetLineWeight(weight, GraphicsStyleType.Projection);
                style.SetLinePatternId(pattern?.Id ?? LinePatternElement.GetSolidPatternId(), GraphicsStyleType.Projection);
                return new JsonObject { ["id"] = style.GetGraphicsStyle(GraphicsStyleType.Projection).Id.Value, ["name"] = name };
            });
        }

        private static JsonNode EnsureTextType(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var size = FromMm(ReqNum(p, "size_mm"));
            var font = Str(p, "font") ?? "Arial";
            var color = ColorOf(p, "color");
            var bold = Bool(p, "bold");

            return InTransaction(doc, $"Text type {name}", () =>
            {
                var existing = new FilteredElementCollector(doc).OfClass(typeof(TextNoteType)).Cast<TextNoteType>()
                    .FirstOrDefault(t => t.Name == name);
                var type = existing ?? (TextNoteType)((TextNoteType)doc.GetElement(
                    doc.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType))).Duplicate(name);
                type.get_Parameter(BuiltInParameter.TEXT_SIZE).Set(size);
                type.get_Parameter(BuiltInParameter.TEXT_FONT).Set(font);
                type.get_Parameter(BuiltInParameter.TEXT_STYLE_BOLD).Set(bold ? 1 : 0);
                type.get_Parameter(BuiltInParameter.LINE_COLOR).Set(color.Red + (color.Green << 8) + (color.Blue << 16));
                // 1 = transparent, so notes do not mask the drawing behind them.
                type.get_Parameter(BuiltInParameter.TEXT_BACKGROUND).Set(1);
                return new JsonObject { ["id"] = type.Id.Value, ["name"] = type.Name };
            });
        }

        private static JsonNode CreateTextNote(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var location = OnViewPlane(view, ReqPoint(p, "location"));
            var text = ReqStr(p, "text");
            return InTransaction(doc, "Create text note", () =>
            {
                var typeId = OptId(p, "text_type_id") ?? doc.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType);
                var note = TextNote.Create(doc, view.Id, location, text, typeId);
                return new JsonObject { ["id"] = note.Id.Value };
            });
        }

        private static JsonNode ExtendViewCrop(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            return InTransaction(doc, "Extend view crop", () =>
            {
                // The crop box's local X and Y are the view's right and up directions.
                var box = view.CropBox;
                box.Min = new XYZ(box.Min.X - FromMm(Num(p, "left_mm") ?? 0), box.Min.Y - FromMm(Num(p, "bottom_mm") ?? 0), box.Min.Z);
                box.Max = new XYZ(box.Max.X + FromMm(Num(p, "right_mm") ?? 0), box.Max.Y + FromMm(Num(p, "top_mm") ?? 0), box.Max.Z);
                view.CropBox = box;
                return new JsonObject { ["id"] = view.Id.Value };
            });
        }

        private static JsonNode RotateViewCrop(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var angle = ReqNum(p, "angle_degrees") * Math.PI / 180;
            return InTransaction(doc, "Rotate view crop", () =>
            {
                view.CropBoxActive = true;
                doc.Regenerate();   // a freshly duplicated or cropped plan has no crop region element until regenerated
                // The crop boundary is a dependent Viewers element of the view; duplicated plans do not share the view's name, so look there first.
                var crop = view.GetDependentElements(new ElementCategoryFilter(BuiltInCategory.OST_Viewers)).Select(doc.GetElement).FirstOrDefault(e => e != null && e.Id != view.Id)
                           ?? new FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Viewers).WhereElementIsNotElementType()
                               .FirstOrDefault(e => e.Name == view.Name && e.Id != view.Id)
                           ?? view.GetDependentElements(null).Select(doc.GetElement).FirstOrDefault(e => e != null && e.Id != view.Id && e.Category != null && (e.Category.Id.Value == (long)BuiltInCategory.OST_Viewers || e.Category.Id.Value == (long)BuiltInCategory.OST_CropBoundary))
                           // Revit 2026 plans: the crop region is an uncategorised Element named like the view (not the SketchPlane).
                           ?? view.GetDependentElements(null).Select(doc.GetElement).FirstOrDefault(e => e != null && e.Id != view.Id && e.Category == null && e.GetType() == typeof(Element) && e.Name == view.Name)
                           ?? throw new InvalidOperationException("Crop region element not found for this view. Dependents: " + string.Join(", ", view.GetDependentElements(null).Select(doc.GetElement).Where(e => e != null).Select(e => (e.Category?.Name ?? e.GetType().Name) + ":" + e.Name).Take(15)));
                var box = view.CropBox;
                var centre = box.Transform.OfPoint((box.Min + box.Max) / 2);
                ElementTransformUtils.RotateElement(doc, crop.Id, Line.CreateBound(centre, centre + XYZ.BasisZ), angle);
                return new JsonObject { ["id"] = view.Id.Value };
            });
        }

        private static JsonNode CreateDirectShape(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var category = ResolveCategory(doc, ReqStr(p, "category"));
            if (!DirectShape.IsValidCategoryId(category.Id, doc))
                throw new ArgumentException($"Category '{category.Name}' cannot hold a direct shape.");
            var name = ReqStr(p, "name");
            var comments = Str(p, "comments");

            var solids = new List<GeometryObject>();
            foreach (var node in p["solids"] as JsonArray ?? throw new ArgumentException("solids is required."))
            {
                var solid = node.AsObject();
                var points = (solid["profile"] as JsonArray ?? throw new ArgumentException("profile is required."))
                    .Select(ToPoint).ToList();
                if (points.Count < 3) throw new ArgumentException("profile needs at least 3 points.");

                var loop = new CurveLoop();
                for (var i = 0; i < points.Count; i++)
                    loop.Append(Line.CreateBound(points[i], points[(i + 1) % points.Count]));
                var loops = new List<CurveLoop> { loop };
                if (solid["hole"] is JsonArray hole)
                {
                    var inner = hole.Select(ToPoint).ToList();
                    var innerLoop = new CurveLoop();
                    for (var i = 0; i < inner.Count; i++)
                        innerLoop.Append(Line.CreateBound(inner[i], inner[(i + 1) % inner.Count]));
                    loops.Add(innerLoop);
                }
                if (solid["holes"] is JsonArray holes)
                {
                    foreach (var holeNode in holes)
                    {
                        var inner = (holeNode as JsonArray ?? throw new ArgumentException("Each entry in holes must be a list of points."))
                            .Select(ToPoint).ToList();
                        var innerLoop = new CurveLoop();
                        for (var i = 0; i < inner.Count; i++)
                            innerLoop.Append(Line.CreateBound(inner[i], inner[(i + 1) % inner.Count]));
                        loops.Add(innerLoop);
                    }
                }
                var materialId = OptId(solid, "material_id") ?? ElementId.InvalidElementId;
                solids.Add(GeometryCreationUtilities.CreateExtrusionGeometry(
                    loops, ReqPoint(solid, "direction").Normalize(), FromMm(ReqNum(solid, "length_mm")),
                    new SolidOptions(materialId, ElementId.InvalidElementId)));
            }

            // union: fuse all the solids of this shape into ONE solid (Boolean union), so pieces that only exist because the
            // bridge can only extrude (e.g. a glass pane with 45 deg mitred edges = body + wedges) become one part with no
            // seams. Pieces that do not touch stay as separate lumps of the same solid.
            if (p["union"] is JsonNode un && un.GetValue<bool>() && solids.Count > 1)
            {
                Solid acc = (Solid)solids[0];
                for (var i = 1; i < solids.Count; i++)
                {
                    try { acc = BooleanOperationsUtils.ExecuteBooleanOperation(acc, (Solid)solids[i], BooleanOperationsType.Union); }
                    catch (Exception ex) { throw new InvalidOperationException($"union failed at solid {i}: {ex.Message}"); }
                }
                solids = new List<GeometryObject> { acc };
            }

            return InTransaction(doc, $"Create {name}", () =>
            {
                var shape = DirectShape.CreateElement(doc, category.Id);
                shape.SetShape(solids);
                shape.Name = name;
                if (comments != null) shape.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                return new JsonObject { ["id"] = shape.Id.Value, ["name"] = shape.Name };
            });
        }

        private sealed class KeepExistingFamily : IFamilyLoadOptions
        {
            public bool OnFamilyFound(bool familyInUse, out bool overwriteParameterValues)
            {
                overwriteParameterValues = false;
                return false;
            }

            public bool OnSharedFamilyFound(Family sharedFamily, bool familyInUse, out FamilySource source, out bool overwriteParameterValues)
            {
                source = FamilySource.Project;
                overwriteParameterValues = false;
                return false;
            }
        }

        private static JsonNode LoadFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var path = ReqStr(p, "path");
            if (!File.Exists(path)) throw new ArgumentException($"Family file not found: '{path}'.");
            var name = Path.GetFileNameWithoutExtension(path);

            return InTransaction(doc, $"Load family {name}", () =>
            {
                // A family that is already loaded is kept as it is, so a load can never overwrite project edits,
                // unless overwrite: true (an edited .rfa replaces the loaded one; placed instances keep their place).
                IFamilyLoadOptions options = p["overwrite"]?.GetValue<bool>() == true ? new OverwriteFamily() : new KeepExistingFamily();
                doc.LoadFamily(path, options, out var family);
                family = family ?? new FilteredElementCollector(doc).OfClass(typeof(Family)).Cast<Family>()
                    .FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                    ?? throw new InvalidOperationException($"Revit did not load '{name}'.");
                var symbols = family.GetFamilySymbolIds().Select(doc.GetElement).Select(s => (JsonNode)new JsonObject
                {
                    ["id"] = s.Id.Value,
                    ["name"] = s.Name,
                });
                return new JsonObject
                {
                    ["family_id"] = family.Id.Value,
                    ["family"] = family.Name,
                    ["category"] = family.FamilyCategory?.Name,
                    ["placement"] = family.FamilyPlacementType.ToString(),
                    ["types"] = new JsonArray(symbols.ToArray()),
                };
            });
        }

        private static JsonNode PlaceOnFace(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var symbol = RequireElement(doc, ReqId(p, "family_type_id")) as FamilySymbol
                         ?? throw new ArgumentException("family_type_id is not a loadable family type.");
            var origin = ReqPoint(p, "origin");
            var direction = ReqPoint(p, "direction").Normalize();
            var maxDistance = FromMm(Num(p, "max_distance_mm") ?? 2000);
            var view = new FilteredElementCollector(doc).OfClass(typeof(View3D)).Cast<View3D>().FirstOrDefault(v => !v.IsTemplate)
                       ?? throw new InvalidOperationException("Placing on a face needs a 3D view in the model.");

            var categories = (p["categories"] as JsonArray)?.Select(n => ResolveCategory(doc, n.GetValue<string>()).Id).ToList();
            var intersector = categories == null
                ? new ReferenceIntersector(new ElementClassFilter(typeof(FamilySymbol), true), FindReferenceTarget.Face, view)
                : new ReferenceIntersector(new ElementMulticategoryFilter(categories), FindReferenceTarget.Face, view);
            var hit = intersector.FindNearest(origin, direction);
            if (hit == null || hit.Proximity > maxDistance)
                throw new InvalidOperationException($"No matching face within {ToMm(maxDistance)} mm of the point.");

            var reference = hit.GetReference();
            var hitPoint = origin + direction * hit.Proximity;
            // The family's X axis: any direction in the face plane that is not parallel to the ray.
            var along = Math.Abs(direction.Z) > 0.9 ? XYZ.BasisX : direction.CrossProduct(XYZ.BasisZ).Normalize();
            var mark = Str(p, "mark");
            var comments = Str(p, "comments");

            return InTransaction(doc, $"Place {symbol.Name}", () =>
            {
                if (!symbol.IsActive)
                {
                    symbol.Activate();
                    doc.Regenerate();
                }
                var instance = doc.Create.NewFamilyInstance(reference, hitPoint, along, symbol);
                if (mark != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                if (comments != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                return new JsonObject
                {
                    ["id"] = instance.Id.Value,
                    ["host_id"] = reference.ElementId.Value,
                    ["host_category"] = doc.GetElement(reference.ElementId)?.Category?.Name,
                    ["point"] = PointJson(hitPoint),
                };
            });
        }

        private static JsonNode EnsureReferencePlane(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var origin = ReqPoint(p, "origin");
            var xDir = ReqPoint(p, "x_direction").Normalize();
            var yDir = ReqPoint(p, "y_direction").Normalize();
            var view = new FilteredElementCollector(doc).OfClass(typeof(View3D)).Cast<View3D>().FirstOrDefault(v => !v.IsTemplate)
                       ?? throw new InvalidOperationException("Creating a plane needs a 3D view in the model.");

            return InTransaction(doc, $"Reference plane {name}", () =>
            {
                var plane = new FilteredElementCollector(doc).OfClass(typeof(ReferencePlane)).Cast<ReferencePlane>()
                                .FirstOrDefault(r => r.Name == name)
                            ?? doc.Create.NewReferencePlane(origin, origin + xDir * FromMm(1000), yDir, view);
                plane.Name = name;
                return new JsonObject { ["id"] = plane.Id.Value, ["name"] = plane.Name, ["normal"] = DirectionJson(plane.Normal) };
            });
        }

        private static JsonNode PlaceOnReferencePlane(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var symbol = RequireElement(doc, ReqId(p, "family_type_id")) as FamilySymbol
                         ?? throw new ArgumentException("family_type_id is not a loadable family type.");
            var plane = RequireElement(doc, ReqId(p, "plane_id")) as ReferencePlane
                        ?? throw new ArgumentException("plane_id is not a reference plane.");
            var point = ReqPoint(p, "location");
            var mark = Str(p, "mark");
            var comments = Str(p, "comments");

            return InTransaction(doc, $"Place {symbol.Name}", () =>
            {
                if (!symbol.IsActive)
                {
                    symbol.Activate();
                    doc.Regenerate();
                }
                var instance = doc.Create.NewFamilyInstance(plane.GetReference(), point, plane.Direction, symbol);
                if (mark != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                if (comments != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                return new JsonObject { ["id"] = instance.Id.Value, ["host_id"] = plane.Id.Value };
            });
        }

        private static Autodesk.Revit.DB.Electrical.VoltageType EnsureVoltage(
            Autodesk.Revit.DB.Electrical.ElectricalSetting settings, double volts)
        {
            var name = $"{volts:0} V";
            var existing = settings.VoltageTypes.Cast<Autodesk.Revit.DB.Electrical.VoltageType>().FirstOrDefault(v => v.Name == name);
            if (existing != null) return existing;
            // Voltage types hold plain volts here, not internal units. Converting makes a 220 V system about 2370 V, and panels reject it.
            double Internal(double v) => v;
            return settings.AddVoltageType(name, Internal(volts), Internal(volts * 0.95), Internal(volts * 1.05));
        }

        private static JsonNode EnsureDistributionSystem(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var lineToLine = ReqNum(p, "line_to_line_v");
            var lineToGround = ReqNum(p, "line_to_ground_v");
            var wires = (int)(Num(p, "wires") ?? 4);
            var single = Str(p, "phase") == "single";

            return InTransaction(doc, $"Distribution system {name}", () =>
            {
                var settings = Autodesk.Revit.DB.Electrical.ElectricalSetting.GetElectricalSettings(doc);
                var system = settings.DistributionSysTypes.Cast<Autodesk.Revit.DB.Electrical.DistributionSysType>()
                                 .FirstOrDefault(s => s.Name == name)
                             ?? settings.AddDistributionSysType(
                                 name,
                                 single ? Autodesk.Revit.DB.Electrical.ElectricalPhase.SinglePhase : Autodesk.Revit.DB.Electrical.ElectricalPhase.ThreePhase,
                                 single ? Autodesk.Revit.DB.Electrical.ElectricalPhaseConfiguration.Undefined : Autodesk.Revit.DB.Electrical.ElectricalPhaseConfiguration.Wye,
                                 wires,
                                 EnsureVoltage(settings, lineToLine),
                                 EnsureVoltage(settings, lineToGround));
                return new JsonObject { ["id"] = system.Id.Value, ["name"] = system.Name };
            });
        }

        private static JsonNode SetViewCategories(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var names = new List<(string Name, bool Hidden)>();
            foreach (var n in p["hide"] as JsonArray ?? new JsonArray()) names.Add((n.GetValue<string>(), true));
            foreach (var n in p["show"] as JsonArray ?? new JsonArray()) names.Add((n.GetValue<string>(), false));

            return InTransaction(doc, "Set view categories", () =>
            {
                var skipped = new JsonArray();
                var changed = 0;
                foreach (var (name, hidden) in names)
                {
                    var id = ResolveCategory(doc, name).Id;
                    if (view.CanCategoryBeHidden(id))
                    {
                        view.SetCategoryHidden(id, hidden);
                        changed++;
                    }
                    else skipped.Add(name);
                }
                return new JsonObject { ["changed"] = changed, ["skipped"] = skipped };
            });
        }

        private static JsonNode GetElectricalInfo(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                           ?? throw new ArgumentException("element_id is not a family instance.");
            var connectors = new JsonArray();
            var manager = instance.MEPModel?.ConnectorManager;
            if (manager != null)
            {
                foreach (Connector connector in manager.Connectors)
                {
                    var item = new JsonObject
                    {
                        ["domain"] = connector.Domain.ToString(),
                        ["system_type"] = connector.Domain == Domain.DomainElectrical ? connector.ElectricalSystemType.ToString() : null,
                    };
                    if (connector.GetMEPConnectorInfo() is MEPFamilyConnectorInfo info)
                    {
                        item["voltage"] = (info.GetConnectorParameterValue(new ElementId(BuiltInParameter.RBS_ELEC_VOLTAGE)) as DoubleParameterValue) is DoubleParameterValue v
                            ? UnitUtils.ConvertFromInternalUnits(v.Value, UnitTypeId.Volts)
                            : (JsonNode)null;
                        item["poles"] = (info.GetConnectorParameterValue(new ElementId(BuiltInParameter.RBS_ELEC_NUMBER_OF_POLES)) as IntegerParameterValue)?.Value;
                    }
                    connectors.Add(item);
                }
            }
            var systems = new FilteredElementCollector(doc).OfClass(typeof(Autodesk.Revit.DB.Electrical.DistributionSysType))
                .Select(s => (JsonNode)new JsonObject { ["id"] = s.Id.Value, ["name"] = s.Name });
            return new JsonObject
            {
                ["is_electrical_equipment"] = instance.MEPModel is Autodesk.Revit.DB.Electrical.ElectricalEquipment,
                ["connectors"] = connectors,
                ["systems"] = new JsonArray(systems.ToArray()),
                ["voltage_types"] = new JsonArray(new FilteredElementCollector(doc)
                    .OfClass(typeof(Autodesk.Revit.DB.Electrical.VoltageType)).Cast<Autodesk.Revit.DB.Electrical.VoltageType>()
                    .Select(v => (JsonNode)new JsonObject
                    {
                        ["name"] = v.Name,
                        ["actual"] = UnitUtils.ConvertFromInternalUnits(v.ActualValue, UnitTypeId.Volts),
                        ["min"] = UnitUtils.ConvertFromInternalUnits(v.MinValue, UnitTypeId.Volts),
                        ["max"] = UnitUtils.ConvertFromInternalUnits(v.MaxValue, UnitTypeId.Volts),
                    }).ToArray()),
            };
        }

        /// <summary>Tries every distribution system on a panel, rolled back, and reports each system's voltages and the result.</summary>
        private static JsonNode DiagnosePanel(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "panel_id")) as FamilyInstance ?? throw new ArgumentException("panel_id is not a family instance.");
            var equipment = instance.MEPModel as Autodesk.Revit.DB.Electrical.ElectricalEquipment ?? throw new ArgumentException("panel_id is not electrical equipment.");
            var rows = new JsonArray();
            foreach (var s in new FilteredElementCollector(doc).OfClass(typeof(Autodesk.Revit.DB.Electrical.DistributionSysType)).Cast<Autodesk.Revit.DB.Electrical.DistributionSysType>())
            {
                string result;
                using (var t = new Transaction(doc, "Try system"))
                {
                    t.Start();
                    try { equipment.DistributionSystem = s; result = "ok"; }
                    catch (Exception e) { result = e.Message; }
                    t.RollBack();
                }
                rows.Add(new JsonObject { ["id"] = s.Id.Value, ["name"] = s.Name, ["phase"] = s.ElectricalPhase.ToString(), ["config"] = s.ElectricalPhaseConfiguration.ToString(), ["wires"] = s.NumWires, ["ll"] = s.VoltageLineToLine?.Name, ["lg"] = s.VoltageLineToGround?.Name, ["result"] = result });
            }
            return new JsonObject { ["systems"] = rows };
        }

        private static JsonNode SetPanelSystem(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "panel_id")) as FamilyInstance
                           ?? throw new ArgumentException("panel_id is not a family instance.");
            var equipment = instance.MEPModel as Autodesk.Revit.DB.Electrical.ElectricalEquipment
                            ?? throw new ArgumentException("panel_id is not electrical equipment.");
            var systemId = ReqId(p, "system_id");
            return InTransaction(doc, "Set panel distribution system", () =>
            {
                equipment.DistributionSystem = RequireElement(doc, systemId) as Autodesk.Revit.DB.Electrical.DistributionSysType
                                               ?? throw new ArgumentException("system_id is not a distribution system.");
                return new JsonObject { ["system"] = equipment.DistributionSystem?.Name };
            });
        }

        /// <summary>Writes voltage, poles, load and power factor to one family connector.</summary>
        private static void SetConnectorValues(Element connector, JsonObject c)
        {
            if (Num(c, "voltage") is double volts) connector.get_Parameter(BuiltInParameter.RBS_ELEC_VOLTAGE)?.Set(UnitUtils.ConvertToInternalUnits(volts, UnitTypeId.Volts));
            if (Num(c, "poles") is double poles) connector.get_Parameter(BuiltInParameter.RBS_ELEC_NUMBER_OF_POLES)?.Set((int)poles);
            if (Num(c, "load_va") is double load)
            {
                var internalLoad = UnitUtils.ConvertToInternalUnits(load, UnitTypeId.VoltAmperes);
                foreach (Parameter q in connector.Parameters)
                    if ((q.Definition.Name == "Apparent Power" || q.Definition.Name == "Apparent Power Phase 1" || q.Definition.Name.Contains("Apparent Load")) && !q.IsReadOnly && q.StorageType == StorageType.Double) q.Set(internalLoad);
                var classification = new FilteredElementCollector(connector.Document).OfClass(typeof(Autodesk.Revit.DB.Electrical.ElectricalLoadClassification)).FirstElementId();
                if (classification != ElementId.InvalidElementId) connector.get_Parameter(BuiltInParameter.RBS_ELEC_LOAD_CLASSIFICATION)?.Set(classification);
            }
            if (Num(c, "power_factor") is double factor) connector.get_Parameter(BuiltInParameter.RBS_ELEC_POWER_FACTOR)?.Set(factor);
        }

        private static void SetFamilyPartType(Document familyDoc, JsonObject c)
        {
            if (Str(c, "part_type") is string part && Enum.TryParse<PartType>(part, true, out var parsed))
                familyDoc.OwnerFamily.get_Parameter(BuiltInParameter.FAMILY_CONTENT_PART_TYPE)?.Set((int)parsed);
        }

        /// <summary>Adds a power connector to a family on its largest planar face, for a unit family that must carry a circuit.</summary>
        private static void AddElectricalConnector(Document familyDoc, IEnumerable<Element> forms, JsonObject c)
        {
            var system = Enum.TryParse<Autodesk.Revit.DB.Electrical.ElectricalSystemType>(Str(c, "system") ?? "PowerCircuit", true, out var parsed)
                ? parsed : Autodesk.Revit.DB.Electrical.ElectricalSystemType.PowerCircuit;
            var options = new Options { ComputeReferences = true };
            var face = forms.SelectMany(form => SolidsOf(form.get_Geometry(options)))
                .SelectMany(solid => solid.Faces.Cast<Face>())
                .OfType<PlanarFace>().Where(q => q.Reference != null).OrderByDescending(q => q.Area).FirstOrDefault()
                ?? throw new InvalidOperationException("The family has no planar face to host a connector.");
            SetConnectorValues(ConnectorElement.CreateElectricalConnector(familyDoc, system, face.Reference), c);
            SetFamilyPartType(familyDoc, c);
        }

        /// <summary>Sets the connectors of a loaded family, so devices and panels can agree on voltage and poles.</summary>
        private static JsonNode SetFamilyConnectors(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var changed = 0;
                using (var transaction = new Transaction(familyDoc, "MCP: Family connectors"))
                {
                    transaction.Start();
                    foreach (var connector in new FilteredElementCollector(familyDoc).OfClass(typeof(ConnectorElement)).Cast<ConnectorElement>().Where(q => q.Domain == Domain.DomainElectrical))
                    {
                        SetConnectorValues(connector, p);
                        changed++;
                    }
                    SetFamilyPartType(familyDoc, p);
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                var report = new JsonArray();
                foreach (var connector in new FilteredElementCollector(familyDoc).OfClass(typeof(ConnectorElement)).Cast<Element>())
                    foreach (Parameter q in connector.Parameters) report.Add($"{q.Definition.Name}={q.AsValueString()}{(q.IsReadOnly ? " (ro)" : "")}");
                return new JsonObject { ["connectors"] = changed, ["parameters"] = report };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        /// <summary>Returns the text of a panel schedule, since the view cannot be exported as an image.</summary>
        private static JsonNode ReadPanelSchedule(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as Autodesk.Revit.DB.Electrical.PanelScheduleView
                       ?? throw new ArgumentException("view_id is not a panel schedule.");
            var rows = new JsonArray();
            foreach (var type in new[] { SectionType.Header, SectionType.Body, SectionType.Summary, SectionType.Footer })
            {
                var section = view.GetTableData().GetSectionData(type);
                if (section == null) continue;
                for (var r = section.FirstRowNumber; r <= section.LastRowNumber; r++)
                {
                    var cells = new List<string>();
                    for (var c = section.FirstColumnNumber; c <= section.LastColumnNumber; c++)
                    {
                        var text = view.GetCellText(type, r, c);
                        if (!string.IsNullOrWhiteSpace(text)) cells.Add(text);
                    }
                    if (cells.Count > 0) rows.Add($"{type}: {string.Join(" | ", cells)}");
                }
            }
            return new JsonObject { ["rows"] = rows };
        }

        /// <summary>Scales a panel schedule's template: text, row heights and column widths. Panel schedules have no view scale.</summary>
        private static JsonNode ScalePanelSchedule(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as Autodesk.Revit.DB.Electrical.PanelScheduleView
                       ?? throw new ArgumentException("view_id is not a panel schedule.");
            var factor = Num(p, "factor") ?? throw new ArgumentException("factor is required.");
            var template = doc.GetElement(view.GetTemplate()) as Autodesk.Revit.DB.Electrical.PanelScheduleTemplate
                           ?? throw new InvalidOperationException("The panel schedule has no template.");
            return InTransaction(doc, "Scale panel schedule", () =>
            {
                var data = template.GetTableData();
                var cells = 0;
                var errors = new JsonArray();
                void Try(string what, Action act)
                {
                    try { act(); }
                    catch (Exception e) { if (errors.Count < 10) errors.Add($"{what}: {e.Message}"); }
                }
                foreach (var type in new[] { SectionType.Header, SectionType.Body, SectionType.Summary, SectionType.Footer })
                {
                    TableSectionData section = null;
                    Try($"{type} section", () => section = data.GetSectionData(type));
                    if (section == null) continue;
                    // Merged cells share one style, so a cell can refuse; skip it and carry on.
                    for (var r = section.FirstRowNumber; r <= section.LastRowNumber; r++)
                        for (var c = section.FirstColumnNumber; c <= section.LastColumnNumber; c++)
                        {
                            int rr = r, cc = c;
                            Try($"{type} cell {rr},{cc}", () =>
                            {
                                var style = section.GetTableCellStyle(rr, cc);
                                var over = style.GetCellStyleOverrideOptions();
                                over.FontSize = true;
                                style.SetCellStyleOverrideOptions(over);
                                style.TextSize *= factor;
                                section.SetCellStyle(rr, cc, style);
                                cells++;
                            });
                        }
                    for (var r = section.FirstRowNumber; r <= section.LastRowNumber; r++)
                    {
                        int rr = r;
                        Try($"{type} row {rr}", () => section.SetRowHeight(rr, section.GetRowHeight(rr) * factor));
                    }
                    for (var c = section.FirstColumnNumber; c <= section.LastColumnNumber; c++)
                    {
                        int cc = c;
                        Try($"{type} column {cc}", () => section.SetColumnWidth(cc, section.GetColumnWidth(cc) * factor));
                    }
                }
                // Take the slot count from the panel's Max Number of Single Pole Breakers, not the template's default.
                if (p["slots_from_panel"]?.GetValue<bool>() == true) Try("slots", () => data.ShowSlotFromDeviceInsteadOfTemplate = true);
                Try("save template", () => template.SetTableData(data));
                return new JsonObject { ["template_id"] = template.Id.Value, ["cells"] = cells, ["errors"] = errors };
            });
        }

        /// <summary>Removes unused distribution systems and voltage types, and renames voltage types.</summary>
        private static JsonNode CleanElectricalTypes(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            return InTransaction(doc, "Clean electrical types", () =>
            {
                var settings = Autodesk.Revit.DB.Electrical.ElectricalSetting.GetElectricalSettings(doc);
                var log = new JsonArray();
                foreach (var n in p["systems"] as JsonArray ?? new JsonArray())
                {
                    var name = n.GetValue<string>();
                    try { settings.RemoveDistributionSysType(settings.DistributionSysTypes.Cast<Autodesk.Revit.DB.Electrical.DistributionSysType>().First(q => q.Name == name)); log.Add("removed system " + name); }
                    catch (Exception e) { log.Add($"kept system {name}: {e.Message}"); }
                }
                foreach (var n in p["voltages"] as JsonArray ?? new JsonArray())
                {
                    var name = n.GetValue<string>();
                    try { settings.RemoveVoltageType(settings.VoltageTypes.Cast<Autodesk.Revit.DB.Electrical.VoltageType>().First(q => q.Name == name)); log.Add("removed voltage " + name); }
                    catch (Exception e) { log.Add($"kept voltage {name}: {e.Message}"); }
                }
                if (p["rename_voltages"] is JsonObject renames)
                    foreach (var pair in renames)
                    {
                        var voltage = settings.VoltageTypes.Cast<Autodesk.Revit.DB.Electrical.VoltageType>().FirstOrDefault(v => v.Name == pair.Key);
                        if (voltage == null) { log.Add("no voltage " + pair.Key); continue; }
                        voltage.Name = pair.Value.GetValue<string>();
                        log.Add($"renamed {pair.Key} to {voltage.Name}");
                    }
                return new JsonObject { ["log"] = log };
            });
        }

        /// <summary>Links another Revit model at the same origin.</summary>
        private static JsonNode LinkRevitModel(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            // Normalise to a Windows path: a link stored with forward slashes loads the file, but Revit
            // cannot bind the instance to it ("Where is the document?"), so the link draws nothing.
            // A cloud model (Autodesk Docs / ACC) is given by region + project and model GUIDs (as a Revit journal or
            // the "CLD:\US{project}...{model}name.rvt" path shows them); otherwise path is a file on disk.
            ModelPath modelPath;
            var source = "";
            if (Str(p, "model_guid") is string mg)
            {
                var region = Str(p, "region") ?? "US";
                modelPath = ModelPathUtils.ConvertCloudGUIDsToCloudPath(region, Guid.Parse(ReqStr(p, "project_guid")), Guid.Parse(mg));
                source = $"cloud {region} {mg}";
            }
            else
            {
                var path = Path.GetFullPath(ReqStr(p, "path"));
                if (!File.Exists(path)) throw new ArgumentException($"Model not found: '{path}'.");
                modelPath = ModelPathUtils.ConvertUserVisiblePathToModelPath(path);
                source = path;
            }
            // "origin" (default): internal origin to internal origin. "shared": by shared coordinates,
            // which needs the two models to share coordinates already.
            var placement = (Str(p, "placement") ?? "origin").ToLowerInvariant() switch
            {
                "origin" => ImportPlacement.Origin,
                "shared" => ImportPlacement.Shared,
                var other => throw new ArgumentException($"placement must be 'origin' or 'shared', not '{other}'."),
            };
            return InTransaction(doc, "Link model", () =>
            {
                // A link already loaded keeps its own type; Revit refuses a second type for the same
                // path, and a freshly created type is not usable until the document regenerates.
                string Norm(string v) { return (v ?? string.Empty).Replace((char)47, (char)92); }
                var wanted = Norm(ModelPathUtils.ConvertModelPathToUserVisiblePath(modelPath));
                // Nested link types (a link inside a link) are not external files: GetExternalFileReference()
                // throws "This Element does not represent an external file" (Aseer ARCH, 9 Nov 2026), so skip them.
                string PathOf(RevitLinkType t)
                {
                    try { return t.IsNestedLink ? null : ModelPathUtils.ConvertModelPathToUserVisiblePath(t.GetExternalFileReference().GetAbsolutePath()); }
                    catch (Autodesk.Revit.Exceptions.InvalidOperationException) { return null; }
                }
                var existing = new FilteredElementCollector(doc)
                    .OfClass(typeof(RevitLinkType)).Cast<RevitLinkType>()
                    .FirstOrDefault(t => PathOf(t) is string pth && string.Equals(Norm(pth), wanted, StringComparison.OrdinalIgnoreCase));
                ElementId typeId;
                if (existing != null) typeId = existing.Id;
                else
                {
                    var loadResult = RevitLinkType.Create(doc, modelPath, new RevitLinkOptions(false));
                    doc.Regenerate();
                    // LinkLoadResult.ElementId is not always the live type id (it can come back
                    // invalid when the link path is already registered), so resolve the type from
                    // the document instead of trusting the load result.
                    typeId = loadResult.ElementId;
                    var created = doc.GetElement(typeId) as RevitLinkType;
                    if (created == null)
                    {
                        var fileName = Path.GetFileName(Norm(Path.GetFullPath(ReqStr(p, "path")))) ?? string.Empty;
                        var match = new FilteredElementCollector(doc)
                            .OfClass(typeof(RevitLinkType)).Cast<RevitLinkType>()
                            .FirstOrDefault(t => (t.Name ?? string.Empty).IndexOf(
                                Path.GetFileNameWithoutExtension(fileName), StringComparison.OrdinalIgnoreCase) >= 0);
                        if (match != null) typeId = match.Id;
                    }
                    if (doc.GetElement(typeId) as RevitLinkType == null)
                        throw new InvalidOperationException(
                            $"Revit created no usable link type for '{ModelPathUtils.ConvertModelPathToUserVisiblePath(modelPath)}'. " +
                            "Check that the file is not open in another Revit session and that the path is on a local disk.");
                }
                var instance = RevitLinkInstance.Create(doc, typeId, placement);
                return new JsonObject { ["type_id"] = typeId.Value, ["id"] = instance.Id.Value, ["placement"] = placement.ToString(), ["source"] = source };
            });
        }

        private static JsonNode SetViewRange(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as ViewPlan ?? throw new ArgumentException("view_id is not a plan view.");
            var top = Num(p, "top_mm");
            var cut = Num(p, "cut_mm");
            var bottom = Num(p, "bottom_mm");
            var depth = Num(p, "view_depth_mm");
            return InTransaction(doc, "Set view range", () =>
            {
                var range = view.GetViewRange();
                if (Bool(p, "relative_to_view_level"))
                    foreach (var plane in new[] { PlanViewPlane.TopClipPlane, PlanViewPlane.CutPlane, PlanViewPlane.BottomClipPlane, PlanViewPlane.ViewDepthPlane })
                        range.SetLevelId(plane, view.GenLevel.Id);
                if (top != null) range.SetOffset(PlanViewPlane.TopClipPlane, FromMm(top.Value));
                if (cut != null) range.SetOffset(PlanViewPlane.CutPlane, FromMm(cut.Value));
                if (bottom != null) range.SetOffset(PlanViewPlane.BottomClipPlane, FromMm(bottom.Value));
                if (depth != null) range.SetOffset(PlanViewPlane.ViewDepthPlane, FromMm(depth.Value));
                var errors = view.CheckPlanViewRangeValidity(range);
                if (errors.Count > 0) throw new ArgumentException("Invalid " + view.ViewType + " range: " + string.Join(", ", errors));
                view.SetViewRange(range);
                return new JsonObject
                {
                    ["level"] = view.GenLevel?.Name,
                    ["top_mm"] = ToMm(range.GetOffset(PlanViewPlane.TopClipPlane)),
                    ["cut_mm"] = ToMm(range.GetOffset(PlanViewPlane.CutPlane)),
                    ["bottom_mm"] = ToMm(range.GetOffset(PlanViewPlane.BottomClipPlane)),
                    ["view_depth_mm"] = ToMm(range.GetOffset(PlanViewPlane.ViewDepthPlane)),
                    ["relative_to_view_level"] = Bool(p, "relative_to_view_level"),
                };
            });
        }

        private static JsonNode ProbeRay(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var origin = ReqPoint(p, "origin");
            var direction = ReqPoint(p, "direction").Normalize();
            var maxDistance = FromMm(Num(p, "max_distance_mm") ?? 5000);
            var limit = (int)(Num(p, "limit") ?? 8);
            var views = new FilteredElementCollector(doc).OfClass(typeof(View3D)).Cast<View3D>().Where(v => !v.IsTemplate).ToList();
            var view = views.FirstOrDefault(v => v.Name == "{3D}") ?? views.FirstOrDefault()
                       ?? throw new InvalidOperationException("Probing needs a 3D view in the model.");

            var rayTarget = (Str(p, "target") ?? "family").Trim().ToLowerInvariant();
            ElementFilter rayFilter = rayTarget == "walls"
                ? new ElementClassFilter(typeof(Wall), true)
                : rayTarget == "all"
                    ? new ElementIsElementTypeFilter(false)
                    : new ElementClassFilter(typeof(FamilySymbol), true);
            var intersector = new ReferenceIntersector(rayFilter, FindReferenceTarget.Face, view)
            {
                FindReferencesInRevitLinks = true,
            };
            var hits = new JsonArray();
            foreach (var hit in intersector.Find(origin, direction).Where(h => h.Proximity <= maxDistance).OrderBy(h => h.Proximity).Take(limit))
            {
                var reference = hit.GetReference();
                var element = doc.GetElement(reference.ElementId);
                var inLink = element is RevitLinkInstance link && reference.LinkedElementId != ElementId.InvalidElementId
                    ? link.GetLinkDocument()?.GetElement(reference.LinkedElementId)
                    : null;
                var target = inLink ?? element;
                hits.Add(new JsonObject
                {
                    ["distance_mm"] = ToMm(hit.Proximity),
                    ["point"] = PointJson(origin + direction * hit.Proximity),
                    ["element_id"] = target?.Id.Value,
                    ["category"] = target?.Category?.Name,
                    ["name"] = target?.Name,
                    ["link"] = inLink != null ? element.Name : null,
                });
            }
            return new JsonObject { ["view"] = view.Name, ["hits"] = hits };
        }

        private static JsonNode CreateSchedule(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var category = ResolveCategory(doc, ReqStr(p, "category"));
            var fields = (p["fields"] as JsonArray ?? throw new ArgumentException("fields is required."))
                .Select(n => n.GetValue<string>()).ToList();
            var sortBy = Str(p, "sort_by");
            var totalField = Str(p, "total_field");
            if (new FilteredElementCollector(doc).OfClass(typeof(ViewSchedule)).Any(v => v.Name == name))
                throw new ArgumentException($"A schedule named '{name}' already exists.");

            return InTransaction(doc, $"Create schedule {name}", () =>
            {
                var schedule = ViewSchedule.CreateSchedule(doc, category.Id);
                schedule.Name = name;
                var definition = schedule.Definition;
                var available = definition.GetSchedulableFields();
                var missing = new JsonArray();
                foreach (var field in fields)
                {
                    var match = available.FirstOrDefault(f => f.GetName(doc).Equals(field, StringComparison.OrdinalIgnoreCase));
                    if (match == null)
                    {
                        missing.Add(field);
                        continue;
                    }
                    var added = definition.AddField(match);
                    if (field.Equals(sortBy, StringComparison.OrdinalIgnoreCase))
                        definition.AddSortGroupField(new ScheduleSortGroupField(added.FieldId));
                    if (field.Equals(totalField, StringComparison.OrdinalIgnoreCase))
                    {
                        added.DisplayType = ScheduleFieldDisplayType.Totals;
                        definition.ShowGrandTotal = true;
                        definition.ShowGrandTotalTitle = true;
                    }
                }
                return new JsonObject
                {
                    ["id"] = schedule.Id.Value,
                    ["name"] = schedule.Name,
                    ["missing_fields"] = missing,
                    ["available_fields"] = missing.Count == 0
                        ? new JsonArray()
                        : new JsonArray(available.Select(f => (JsonNode)f.GetName(doc)).ToArray()),
                };
            });
        }

        private static JsonNode ListFamilyText(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var items = new JsonArray();
                foreach (var e in new FilteredElementCollector(familyDoc).OfClass(typeof(TextElement)).Cast<TextElement>())
                    items.Add(new JsonObject { ["id"] = e.Id.Value, ["class"] = e.GetType().Name, ["text"] = e.Text, ["x"] = e.Coord.X * MmPerFoot, ["y"] = e.Coord.Y * MmPerFoot });
                var views = new JsonArray(new FilteredElementCollector(familyDoc).OfClass(typeof(View)).Cast<View>().Select(v => (JsonNode)$"{v.GetType().Name}:{v.Name}").ToArray());
                return new JsonObject { ["family"] = familyDoc.Title, ["items"] = items, ["views"] = views };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static JsonNode SetFamilyText(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var oldText = ReqStr(p, "old_text");
            var newText = ReqStr(p, "new_text");
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            var changed = 0;
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Set family text"))
                {
                    transaction.Start();
                    foreach (var note in new FilteredElementCollector(familyDoc).OfClass(typeof(TextNote)).Cast<TextNote>())
                    {
                        if (note.Text.Trim() != oldText) continue;
                        note.Text = newText;
                        changed++;
                    }
                    transaction.Commit();
                }
                if (changed > 0) familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }
            return new JsonObject { ["changed"] = changed };
        }

        private static JsonNode AddTitleblockRevisionSchedule(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var location = ReqPoint(p, "location");
            var fields = (p["fields"] as JsonArray ?? throw new ArgumentException("fields is required.")).Select(n => n.AsObject()).ToList();
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            var missing = new JsonArray();
            try
            {
                var sheet = new FilteredElementCollector(familyDoc).OfClass(typeof(ViewSheet)).Cast<ViewSheet>().FirstOrDefault()
                            ?? throw new InvalidOperationException("The family has no sheet view to place a revision schedule on.");
                using (var transaction = new Transaction(familyDoc, "MCP: Add revision schedule"))
                {
                    transaction.Start();
                    var schedule = ViewSchedule.CreateRevisionSchedule(familyDoc);
                    var definition = schedule.Definition;
                    foreach (var fieldId in definition.GetFieldOrder().ToList()) definition.RemoveField(fieldId);
                    var available = definition.GetSchedulableFields();
                    foreach (var field in fields)
                    {
                        var name = field["name"].GetValue<string>();
                        var match = available.FirstOrDefault(f => f.GetName(familyDoc).Equals(name, StringComparison.OrdinalIgnoreCase));
                        if (match == null)
                        {
                            missing.Add(name);
                            continue;
                        }
                        var added = definition.AddField(match);
                        if (field["heading"] != null) added.ColumnHeading = field["heading"].GetValue<string>();
                        added.GridColumnWidth = FromMm(field["width_mm"].GetValue<double>());
                    }
                    // The REVISIONS panel already has its heading, so the schedule shows no title of its own.
                    definition.ShowTitle = false;
                    ScheduleSheetInstance.Create(familyDoc, sheet.Id, schedule.Id, location);
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }
            return new JsonObject { ["placed"] = true, ["missing_fields"] = missing };
        }

        private static JsonNode CreateRevision(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            return InTransaction(doc, "Create revision", () =>
            {
                var revision = Revision.Create(doc);
                revision.RevisionDate = ReqStr(p, "date");
                revision.Description = ReqStr(p, "description");
                revision.IssuedBy = Str(p, "issued_by") ?? "";
                revision.IssuedTo = Str(p, "issued_to") ?? "";
                if (p["issued"]?.GetValue<bool>() == true) revision.Issued = true;
                return new JsonObject { ["id"] = revision.Id.Value, ["number"] = revision.RevisionNumber };
            });
        }

        private static JsonNode SetSheetRevisions(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var sheets = ReqIds(p, "sheet_ids");
            var revisions = ReqIds(p, "revision_ids");
            return InTransaction(doc, "Set sheet revisions", () =>
            {
                foreach (var id in sheets)
                    (RequireElement(doc, id) as ViewSheet ?? throw new ArgumentException($"{id.Value} is not a sheet.")).SetAdditionalRevisionIds(revisions);
                return new JsonObject { ["sheets"] = sheets.Count, ["revisions"] = revisions.Count };
            });
        }

        private static JsonNode CreateSheetList(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var fields = (p["fields"] as JsonArray ?? throw new ArgumentException("fields is required.")).Select(n => n.GetValue<string>()).ToList();
            var sorts = (p["sort_by"] as JsonArray ?? new JsonArray()).Select(n => n.GetValue<string>()).ToList();
            if (new FilteredElementCollector(doc).OfClass(typeof(ViewSchedule)).Any(v => v.Name == name))
                throw new ArgumentException($"A schedule named '{name}' already exists.");
            return InTransaction(doc, $"Create sheet list {name}", () =>
            {
                var schedule = ViewSchedule.CreateSheetList(doc);
                schedule.Name = name;
                var definition = schedule.Definition;
                var available = definition.GetSchedulableFields();
                var missing = new JsonArray();
                var added = new Dictionary<string, ScheduleField>(StringComparer.OrdinalIgnoreCase);
                foreach (var field in fields)
                {
                    var match = available.FirstOrDefault(f => f.GetName(doc).Equals(field, StringComparison.OrdinalIgnoreCase));
                    if (match == null) missing.Add(field);
                    else added[field] = definition.AddField(match);
                }
                foreach (var sort in sorts)
                    if (added.TryGetValue(sort, out var field)) definition.AddSortGroupField(new ScheduleSortGroupField(field.FieldId));
                // Optional filters, e.g. one submittal's sheets only: [{ "field": "Sheet Name", "op": "begins_with", "value": "Type 4" }].
                // A filter field not in "fields" is added hidden. ops: equals, not_equals, contains, not_contains, begins_with, not_begins_with.
                foreach (var fn in p["filters"] as JsonArray ?? new JsonArray())
                {
                    var fo = fn as JsonObject ?? throw new ArgumentException("Each filter is an object.");
                    var fname = fo["field"]?.GetValue<string>() ?? throw new ArgumentException("filter.field is required.");
                    if (!added.TryGetValue(fname, out var ff))
                    {
                        var m = available.FirstOrDefault(f => f.GetName(doc).Equals(fname, StringComparison.OrdinalIgnoreCase))
                            ?? throw new ArgumentException($"Filter field '{fname}' is not a sheet field.");
                        ff = definition.AddField(m); ff.IsHidden = true; added[fname] = ff;
                    }
                    var op = (fo["op"]?.GetValue<string>() ?? "equals").ToLowerInvariant();
                    var type = op switch
                    {
                        "equals" => ScheduleFilterType.Equal,
                        "not_equals" => ScheduleFilterType.NotEqual,
                        "contains" => ScheduleFilterType.Contains,
                        "not_contains" => ScheduleFilterType.NotContains,
                        "begins_with" => ScheduleFilterType.BeginsWith,
                        "not_begins_with" => ScheduleFilterType.NotBeginsWith,
                        _ => throw new ArgumentException($"Unknown filter op '{op}'.")
                    };
                    definition.AddFilter(new ScheduleFilter(ff.FieldId, type, fo["value"]?.GetValue<string>() ?? ""));
                }
                return new JsonObject { ["id"] = schedule.Id.Value, ["name"] = schedule.Name, ["missing_fields"] = missing };
            });
        }

        private static JsonNode SetScheduleFormat(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var schedule = RequireElement(doc, ReqId(p, "view_id")) as ViewSchedule ?? throw new ArgumentException("view_id is not a schedule.");
            var widths = (p["column_widths_mm"] as JsonArray)?.Select(n => n.GetValue<double>()).ToList();
            var headings = (p["headings"] as JsonArray)?.Select(n => n?.GetValue<string>()).ToList();
            return InTransaction(doc, "Format schedule", () =>
            {
                if (OptId(p, "text_type_id") is ElementId body)
                {
                    schedule.BodyTextTypeId = body;
                    schedule.HeaderTextTypeId = body;
                }
                if (OptId(p, "title_text_type_id") is ElementId title) schedule.TitleTextTypeId = title;
                var definition = schedule.Definition;
                var visible = definition.GetFieldOrder().Select(definition.GetField).Where(f => !f.IsHidden).ToList();
                for (var i = 0; i < visible.Count; i++)
                {
                    if (widths != null && i < widths.Count) visible[i].GridColumnWidth = FromMm(widths[i]);
                    if (headings != null && i < headings.Count && headings[i] != null) visible[i].ColumnHeading = headings[i];
                }
                return new JsonObject { ["columns"] = visible.Count };
            });
        }

        private static JsonNode ViewCategoryCounts(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var counts = new SortedDictionary<string, int>();
            var diagonals = new JsonArray();
            foreach (var e in new FilteredElementCollector(doc, view.Id).WhereElementIsNotElementType())
            {
                var category = e.Category?.Name ?? e.GetType().Name;
                counts[category] = counts.TryGetValue(category, out var n) ? n + 1 : 1;
                var curve = (e as CurveElement)?.GeometryCurve ?? (e.Location as LocationCurve)?.Curve;
                if (curve is Line line && line.Length > FromMm(3000))
                {
                    var d = line.Direction;
                    if (Math.Abs(d.X) > 0.05 && Math.Abs(d.Y) > 0.05)
                        diagonals.Add(new JsonObject { ["id"] = e.Id.Value, ["category"] = category, ["class"] = e.GetType().Name, ["name"] = e.Name, ["length_mm"] = line.Length * MmPerFoot });
                }
            }
            var result = new JsonObject();
            foreach (var pair in counts) result[pair.Key] = pair.Value;
            return new JsonObject { ["counts"] = result, ["diagonals"] = diagonals };
        }

        private static JsonNode SetViewOverrides(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var names = (p["categories"] as JsonArray ?? throw new ArgumentException("categories is required.")).Select(n => n.GetValue<string>()).ToList();
            var halftone = p["halftone"]?.GetValue<bool>() ?? false;
            // Optional discipline colour: lines and a solid surface and cut fill in that colour (coordination views).
            Color color = p["color"] is JsonObject ? ColorOf(p, "color") : null;
            var transparency = (int?)Num(p, "transparency");
            return InTransaction(doc, "Set view overrides", () =>
            {
                var skipped = new JsonArray();
                var changed = 0;
                var solid = color == null ? null : new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().First(f => f.GetFillPattern().IsSolidFill);
                foreach (var name in names)
                {
                    var id = ResolveCategory(doc, name).Id;
                    if (!view.IsCategoryOverridable(id))
                    {
                        skipped.Add(name);
                        continue;
                    }
                    var settings = new OverrideGraphicSettings();
                    settings.SetHalftone(halftone);
                    if (color != null)
                    {
                        settings.SetProjectionLineColor(color);
                        settings.SetCutLineColor(color);
                        settings.SetSurfaceForegroundPatternId(solid.Id);
                        settings.SetSurfaceForegroundPatternColor(color);
                        settings.SetCutForegroundPatternId(solid.Id);
                        settings.SetCutForegroundPatternColor(color);
                    }
                    if (transparency.HasValue) settings.SetSurfaceTransparency(transparency.Value);
                    view.SetCategoryOverrides(id, settings);
                    changed++;
                }
                return new JsonObject { ["changed"] = changed, ["skipped"] = skipped };
            });
        }

        private static JsonNode SetElementOverrides(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var ids = (p["element_ids"] as JsonArray ?? throw new ArgumentException("element_ids is required.")).Select(n => new ElementId(n.GetValue<long>())).ToList();
            var halftone = p["halftone"]?.GetValue<bool>() ?? false;
            // Optional: line_pattern (name) for projection and cut lines, line_weight (1-16), hide_patterns (outline only).
            var patternName = Str(p, "line_pattern");
            var weight = Num(p, "line_weight");
            var hidePatterns = p["hide_patterns"]?.GetValue<bool>() ?? false;
            // Optional: surface_transparency 0-100; 100 leaves only the edges in shaded views.
            var transparency = Num(p, "surface_transparency");
            // Optional: line_color {r,g,b} for projection and cut lines. White (255,255,255) hides joint edges on a sheet
            // (plywood sheets, cladding panels) while the parts behind stay hidden by the surface.
            Color lineColor = p["line_color"] is JsonObject ? ColorOf(p, "line_color") : null;
            // Optional: surface_fill_color / cut_fill_color {r,g,b}: solid fill, e.g. a showcase body in its finish colour.
            Color surfaceFill = p["surface_fill_color"] is JsonObject ? ColorOf(p, "surface_fill_color") : null;
            Color cutFill = p["cut_fill_color"] is JsonObject ? ColorOf(p, "cut_fill_color") : null;
            var solidFill = (surfaceFill == null && cutFill == null) ? null
                : new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().First(f => f.GetFillPattern().IsSolidFill);
            var linePattern = patternName == null ? null
                : LinePatternElement.GetLinePatternElementByName(doc, patternName) ?? throw new ArgumentException($"No line pattern named '{patternName}'.");
            return InTransaction(doc, "Set element overrides", () =>
            {
                foreach (var id in ids)
                {
                    var settings = view.GetElementOverrides(id);
                    settings.SetHalftone(halftone);
                    if (linePattern != null)
                    {
                        settings.SetProjectionLinePatternId(linePattern.Id);
                        settings.SetCutLinePatternId(linePattern.Id);
                    }
                    if (weight != null)
                    {
                        settings.SetProjectionLineWeight((int)weight);
                        settings.SetCutLineWeight((int)weight);
                    }
                    if (hidePatterns)
                    {
                        settings.SetSurfaceForegroundPatternVisible(false);
                        settings.SetSurfaceBackgroundPatternVisible(false);
                        settings.SetCutForegroundPatternVisible(false);
                        settings.SetCutBackgroundPatternVisible(false);
                    }
                    // cut_fill_pattern: drafting pattern name (e.g. "Hatch 45 4") drawn on the cut faces, thin grey (ISO 128)
                    if (Str(p, "cut_fill_pattern") is string cfp)
                    {
                        var fpe = new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().FirstOrDefault(f => f.Name == cfp)
                                  ?? throw new ArgumentException($"No fill pattern '{cfp}'.");
                        settings.SetCutForegroundPatternId(fpe.Id);
                        settings.SetCutForegroundPatternVisible(true);
                        settings.SetCutForegroundPatternColor(fpe.GetFillPattern().IsSolidFill ? new Color(0, 0, 0) : new Color(128, 128, 128));
                    }
                    if (transparency != null) settings.SetSurfaceTransparency(Math.Max(0, Math.Min(100, (int)transparency)));
                    if (surfaceFill != null)
                    {
                        settings.SetSurfaceForegroundPatternId(solidFill.Id); settings.SetSurfaceForegroundPatternColor(surfaceFill);
                        settings.SetSurfaceForegroundPatternVisible(true);
                    }
                    if (cutFill != null)
                    {
                        settings.SetCutForegroundPatternId(solidFill.Id); settings.SetCutForegroundPatternColor(cutFill);
                        settings.SetCutForegroundPatternVisible(true);
                    }
                    if (lineColor != null)
                    {
                        settings.SetProjectionLineColor(lineColor);
                        settings.SetCutLineColor(lineColor);
                    }
                    view.SetElementOverrides(id, settings);
                }
                return new JsonObject { ["changed"] = ids.Count, ["line_pattern"] = linePattern?.Name, ["hide_patterns"] = hidePatterns };
            });
        }

        private static JsonNode EnsureProjectParameters(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var category = ResolveCategory(doc, ReqStr(p, "category"));
            var parameters = (p["parameters"] as JsonArray ?? throw new ArgumentException("parameters is required.")).Select(n => n.AsObject()).ToList();

            return InTransaction(doc, "Add project parameters", () =>
            {
                // Shared parameter definitions need a file, so use a private one and restore the user's setting afterwards.
                var previous = app.Application.SharedParametersFilename;
                var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RevitMcp");
                Directory.CreateDirectory(dir);
                var file = Path.Combine(dir, "shared-parameters.txt");
                if (!File.Exists(file)) File.WriteAllText(file, "");
                var added = new JsonArray();
                try
                {
                    app.Application.SharedParametersFilename = file;
                    var shared = app.Application.OpenSharedParameterFile();
                    var group = shared.Groups.get_Item("RevitMcp") ?? shared.Groups.Create("RevitMcp");
                    var categories = app.Application.Create.NewCategorySet();
                    categories.Insert(category);
                    foreach (var item in parameters)
                    {
                        var name = ReqStr(item, "name");
                        var spec = Bool(item, "number") ? SpecTypeId.Number : SpecTypeId.String.Text;
                        var definition = group.Definitions.get_Item(name)
                                         ?? group.Definitions.Create(new ExternalDefinitionCreationOptions(name, spec));
                        doc.ParameterBindings.Insert(definition, app.Application.Create.NewInstanceBinding(categories), GroupTypeId.Data);
                        added.Add(name);
                    }
                }
                finally
                {
                    app.Application.SharedParametersFilename = previous ?? "";
                }
                return new JsonObject { ["added"] = added };
            });
        }

        private sealed class OverwriteFamily : IFamilyLoadOptions
        {
            public bool OnFamilyFound(bool familyInUse, out bool overwriteParameterValues)
            {
                overwriteParameterValues = false;
                return true;
            }

            public bool OnSharedFamilyFound(Family sharedFamily, bool familyInUse, out FamilySource source, out bool overwriteParameterValues)
            {
                source = FamilySource.Family;
                overwriteParameterValues = false;
                return true;
            }
        }

        private static JsonNode EnableVoidCut(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Allow cut with voids"))
                {
                    transaction.Start();
                    var parameter = familyDoc.OwnerFamily.get_Parameter(BuiltInParameter.FAMILY_ALLOW_CUT_WITH_VOIDS)
                                    ?? throw new InvalidOperationException("This family has no cut-with-voids setting.");
                    parameter.Set(1);
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }
            var reloaded = (FamilyInstance)doc.GetElement(target.Id);
            return new JsonObject
            {
                ["family_allows_void_cut"] = reloaded.Symbol.Family.get_Parameter(BuiltInParameter.FAMILY_ALLOW_CUT_WITH_VOIDS)?.AsInteger(),
                ["can_be_cut_with_void"] = InstanceVoidCutUtils.CanBeCutWithVoid(reloaded),
            };
        }

        private static JsonNode CreateVoidFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var template = ReqStr(p, "template_path");
            if (!File.Exists(template)) throw new ArgumentException($"Template not found: '{template}'.");
            var name = ReqStr(p, "name");
            var radius = FromMm(ReqNum(p, "diameter_mm") / 2);
            var bottom = FromMm(ReqNum(p, "bottom_mm"));
            var height = FromMm(ReqNum(p, "height_mm"));

            var familyDoc = app.Application.NewFamilyDocument(template);
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Void cutter"))
                {
                    transaction.Start();
                    familyDoc.OwnerFamily.get_Parameter(BuiltInParameter.FAMILY_ALLOW_CUT_WITH_VOIDS)?.Set(1);
                    var plane = Plane.CreateByNormalAndOrigin(XYZ.BasisZ, new XYZ(0, 0, bottom));
                    var loop = new CurveArray();
                    loop.Append(Arc.Create(plane, radius, 0, Math.PI));
                    loop.Append(Arc.Create(plane, radius, Math.PI, 2 * Math.PI));
                    var profile = new CurveArrArray();
                    profile.Append(loop);
                    familyDoc.FamilyCreate.NewExtrusion(false, profile, SketchPlane.Create(familyDoc, plane), height);
                    transaction.Commit();
                }
                // A family takes its name from its file, so save a copy before loading it.
                var dir = Path.Combine(Path.GetTempPath(), "RevitMcp", Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(dir);
                var path = Path.Combine(dir, name + ".rfa");
                familyDoc.SaveAs(path);
                var family = familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject
                {
                    ["family_id"] = family.Id.Value,
                    ["family"] = family.Name,
                    ["types"] = new JsonArray(family.GetFamilySymbolIds().Select(id => (JsonNode)id.Value).ToArray()),
                };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static IEnumerable<Solid> SolidsOf(GeometryElement geometry)
        {
            foreach (var item in geometry)
            {
                if (item is Solid solid && solid.Volume > 0) yield return solid;
                else if (item is GeometryInstance instance)
                    foreach (var nested in SolidsOf(instance.GetInstanceGeometry())) yield return nested;
            }
        }

        /// <summary>Turns existing elements into one loadable family, then places it where they were and removes them.</summary>
        private static JsonNode MakeUnitFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var template = ReqStr(p, "template_path");
            if (!File.Exists(template)) throw new ArgumentException($"Template not found: '{template}'.");
            var name = ReqStr(p, "family_name");
            var saveDir = ReqStr(p, "save_dir");
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var mark = Str(p, "mark");
            var comments = Str(p, "comments");
            var elementIds = ReqIds(p, "element_ids");

            var options = new Options { DetailLevel = ViewDetailLevel.Fine };
            var parts = new List<(Solid Solid, string Material, Color Color)>();
            foreach (var id in elementIds)
            {
                foreach (var solid in SolidsOf(RequireElement(doc, id).get_Geometry(options)))
                {
                    var material = solid.Faces.Size > 0 ? doc.GetElement(solid.Faces.get_Item(0).MaterialElementId) as Material : null;
                    parts.Add((solid, material?.Name, material?.Color));
                }
            }
            if (parts.Count == 0) throw new ArgumentException("The elements have no solid geometry.");

            // The unit's lowest corner becomes the family's origin, so the instance sits where the parts were.
            var corners = parts.SelectMany(part =>
            {
                var box = part.Solid.GetBoundingBox();
                return new[] { box.Transform.OfPoint(box.Min), box.Transform.OfPoint(box.Max) };
            }).ToList();
            var origin = new XYZ(corners.Min(c => c.X), corners.Min(c => c.Y), corners.Min(c => c.Z));
            var toFamily = Transform.CreateTranslation(origin.Negate());

            Family family;
            var familyDoc = app.Application.NewFamilyDocument(template);
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Unit family"))
                {
                    transaction.Start();
                    var materials = new Dictionary<string, ElementId>();
                    var forms = new List<Element>();
                    foreach (var part in parts)
                    {
                        var form = FreeFormElement.Create(familyDoc, SolidUtils.CreateTransformed(part.Solid, toFamily));
                        forms.Add(form);
                        if (part.Material == null) continue;
                        if (!materials.TryGetValue(part.Material, out var materialId))
                        {
                            materialId = Material.Create(familyDoc, part.Material);
                            if (part.Color != null && part.Color.IsValid) ((Material)familyDoc.GetElement(materialId)).Color = part.Color;
                            materials[part.Material] = materialId;
                        }
                        form.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(materialId);
                    }
                    if (p["connector"] is JsonObject connector)
                    {
                        familyDoc.Regenerate();
                        AddElectricalConnector(familyDoc, forms, connector);
                    }
                    transaction.Commit();
                }
                // A family takes its name from its file.
                Directory.CreateDirectory(saveDir);
                familyDoc.SaveAs(Path.Combine(saveDir, name + ".rfa"), new SaveAsOptions { OverwriteExistingFile = true });
                family = familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }

            return InTransaction(doc, $"Place {name}", () =>
            {
                var symbol = (FamilySymbol)doc.GetElement(family.GetFamilySymbolIds().First());
                if (!symbol.IsActive)
                {
                    symbol.Activate();
                    doc.Regenerate();
                }
                var instance = doc.Create.NewFamilyInstance(origin, symbol, level, Autodesk.Revit.DB.Structure.StructuralType.NonStructural);
                if (mark != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_MARK)?.Set(mark);
                if (comments != null) instance.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                doc.Delete(elementIds);
                return new JsonObject
                {
                    ["id"] = instance.Id.Value,
                    ["family"] = family.Name,
                    ["family_id"] = family.Id.Value,
                    ["type_id"] = symbol.Id.Value,
                    ["solids"] = parts.Count,
                    ["origin_mm"] = new JsonArray(origin.X * MmPerFoot, origin.Y * MmPerFoot, origin.Z * MmPerFoot),
                };
            });
        }

        /// <summary>Dimensions a string of points along a line in a view, using short detail ticks as the references.</summary>
        private static JsonNode CreateDimensionString(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var points = (p["points"] as JsonArray ?? throw new ArgumentException("points is required.")).Select(ToPoint).Select(q => OnViewPlane(view, q)).ToList();
            if (points.Count < 2) throw new ArgumentException("points needs at least 2 points.");
            var along = (points.Last() - points.First()).Normalize();
            var across = view.ViewDirection.CrossProduct(along).Normalize();
            var offset = FromMm(Num(p, "offset_mm") ?? 0);
            var tick = FromMm(Num(p, "tick_mm") ?? 20);
            // witness: references stay at the measured points and only the dimension line is offset, so Revit draws extension legs.
            var witness = p["witness"]?.GetValue<bool>() == true;
            return InTransaction(doc, "Create dimension", () =>
            {
                var references = new ReferenceArray();
                foreach (var point in points)
                {
                    var at = witness ? point : point + across * offset;
                    var curve = doc.Create.NewDetailCurve(view, Line.CreateBound(at - across * tick / 2, at + across * tick / 2));
                    references.Append(curve.GeometryCurve.Reference);
                }
                var line = Line.CreateBound(points.First() + across * offset, points.Last() + across * offset);
                var dimension = doc.Create.NewDimension(view, line, references);
                return new JsonObject { ["id"] = dimension.Id.Value, ["value_mm"] = dimension.Value.HasValue ? dimension.Value.Value * MmPerFoot : null };
            });
        }

        /// <summary>Tags elements in a view with a tag type, each at its own point.</summary>
        private static JsonNode TagElements(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var typeId = ReqId(p, "tag_type_id");
            var leader = Bool(p, "leader");
            var items = p["items"] as JsonArray ?? throw new ArgumentException("items is required.");
            return InTransaction(doc, "Tag elements", () =>
            {
                var created = new JsonArray();
                var failed = new JsonArray();
                foreach (var node in items)
                {
                    var o = node.AsObject();
                    var element = RequireElement(doc, ReqId(o, "element_id"));
                    try
                    {
                        var tag = IndependentTag.Create(doc, typeId, view.Id, new Reference(element), leader, TagOrientation.Horizontal, OnViewPlane(view, ReqPoint(o, "location")));
                        created.Add(tag.Id.Value);
                    }
                    catch (Exception e)
                    {
                        failed.Add($"{element.Id.Value}: {e.Message}");
                    }
                }
                return new JsonObject { ["created"] = created, ["failed"] = failed };
            });
        }

        /// <summary>Creates a drafting view, for legends and notes.</summary>
        private static JsonNode CreateDraftingView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var scale = (int)(Num(p, "scale") ?? 20);
            var familyType = new FilteredElementCollector(doc).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>().First(t => t.ViewFamily == ViewFamily.Drafting);
            return InTransaction(doc, "Create drafting view", () =>
            {
                var view = ViewDrafting.Create(doc, familyType.Id);
                view.Name = name;
                view.Scale = scale;
                return new JsonObject { ["id"] = view.Id.Value, ["name"] = view.Name };
            });
        }

        /// <summary>Draws a solid colour rectangle in a drafting view or sheet, for a legend swatch.</summary>
        private static JsonNode CreateSwatch(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var min = ReqPoint(p, "min");
            var max = ReqPoint(p, "max");
            var color = ColorOf(p, "color");
            return InTransaction(doc, "Create swatch", () =>
            {
                // fill_pattern: optional drafting pattern name (e.g. "Hatch 45 4" from set_material_hatch) for a hatched swatch
                var patName = Str(p, "fill_pattern");
                var pats = new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>();
                var solid = patName == null ? pats.First(f => f.GetFillPattern().IsSolidFill)
                    : pats.FirstOrDefault(f => f.Name == patName) ?? throw new ArgumentException($"No fill pattern '{patName}'.");
                var baseType = new FilteredElementCollector(doc).OfClass(typeof(FilledRegionType)).Cast<FilledRegionType>().First();
                var typeName = patName == null ? $"Swatch {color.Red}-{color.Green}-{color.Blue}" : $"Swatch {patName} {color.Red}-{color.Green}-{color.Blue}";
                var type = new FilteredElementCollector(doc).OfClass(typeof(FilledRegionType)).Cast<FilledRegionType>().FirstOrDefault(t => t.Name == typeName);
                if (type == null)
                {
                    type = (FilledRegionType)baseType.Duplicate(typeName);
                    type.ForegroundPatternId = solid.Id;
                    type.ForegroundPatternColor = color;
                    type.BackgroundPatternId = ElementId.InvalidElementId;
                }
                var corners = new[] { new XYZ(min.X, min.Y, 0), new XYZ(max.X, min.Y, 0), new XYZ(max.X, max.Y, 0), new XYZ(min.X, max.Y, 0) };
                var loop = new CurveLoop();
                for (var i = 0; i < 4; i++) loop.Append(Line.CreateBound(corners[i], corners[(i + 1) % 4]));
                var region = FilledRegion.Create(doc, type.Id, view.Id, new List<CurveLoop> { loop });
                return new JsonObject { ["id"] = region.Id.Value };
            });
        }

        /// <summary>Numbers project revisions with a numeric sequence, such as 03 for the first issue.</summary>
        private static JsonNode SetRevisionNumbering(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var start = (int)(Num(p, "start") ?? 1);
            var digits = (int)(Num(p, "min_digits") ?? 2);
            return InTransaction(doc, "Set revision numbering", () =>
            {
                var settings = new NumericRevisionSettings { StartNumber = start, MinimumDigits = digits };
                var sequence = RevisionNumberingSequence.CreateNumericSequence(doc, Str(p, "name") ?? "Samaya Numeric", settings);
                foreach (var id in Revision.GetAllRevisionIds(doc)) ((Revision)doc.GetElement(id)).RevisionNumberingSequenceId = sequence.Id;
                return new JsonObject { ["sequence_id"] = sequence.Id.Value };
            });
        }

        /// <summary>Revision numbering Per Project or Per Sheet ("mode": "per_sheet" | "per_project"). Per Sheet lets
        /// several submittals in one model each start at their own first number (Aseer Type 1 and Type 4 both 00).</summary>
        private static JsonNode SetRevisionNumberingMode(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var mode = (Str(p, "mode") ?? "per_sheet").ToLowerInvariant();
            return InTransaction(doc, "Set revision numbering mode", () =>
            {
                var settings = RevisionSettings.GetRevisionSettings(doc);
                settings.RevisionNumbering = mode == "per_project" ? RevisionNumbering.PerProject : RevisionNumbering.PerSheet;
                return new JsonObject { ["mode"] = settings.RevisionNumbering.ToString() };
            });
        }

        /// <summary>Assigns a revision to a numbering sequence.</summary>
        private static JsonNode SetRevisionSequence(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var revision = RequireElement(doc, ReqId(p, "revision_id")) as Revision ?? throw new ArgumentException("revision_id is not a revision.");
            // like_revision_id: use the numbering of another revision (a new revision otherwise takes the default Numeric one).
            var sequence = OptId(p, "like_revision_id") is ElementId like
                ? ((doc.GetElement(like) as Revision) ?? throw new ArgumentException("like_revision_id is not a revision.")).RevisionNumberingSequenceId
                : ReqId(p, "sequence_id");
            return InTransaction(doc, "Set revision sequence", () =>
            {
                revision.RevisionNumberingSequenceId = sequence;
                return new JsonObject { ["number"] = revision.RevisionNumber };
            });
        }

        /// <summary>Paints every face of an element with a material.</summary>
        private static JsonNode PaintElement(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var element = RequireElement(doc, ReqId(p, "element_id"));
            var material = ReqId(p, "material_id");
            var options = new Options { ComputeReferences = true, DetailLevel = ViewDetailLevel.Fine };
            return InTransaction(doc, "Paint element", () =>
            {
                int painted = 0, skipped = 0;
                foreach (var solid in SolidsOf(element.get_Geometry(options)))
                {
                    foreach (Face face in solid.Faces)
                    {
                        if (doc.IsPainted(element.Id, face) || !IsPaintable(doc, element.Id, face)) { skipped++; continue; }
                        doc.Paint(element.Id, face, material);
                        painted++;
                    }
                }
                return new JsonObject { ["painted"] = painted, ["skipped"] = skipped };
            });
        }

        private static bool IsPaintable(Document doc, ElementId id, Face face)
        {
            try { doc.IsPainted(id, face); return true; } catch { return false; }
        }

        /// <summary>Exports sheets to one vector PDF, or one per sheet.</summary>
        /// <summary>Saves (or replaces) a named sheet set, the list Revit's Print and Export (PDF/DWG) dialogs offer
        /// under "Selected views/sheets". Lists the sets when called with no name.</summary>
        private static JsonNode SaveSheetSet(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = Str(p, "name");
            var existing = new FilteredElementCollector(doc).OfClass(typeof(ViewSheetSet)).Cast<ViewSheetSet>().ToList();
            if (name == null) return new JsonObject { ["sets"] = new JsonArray(existing.Select(s => (JsonNode)JsonValue.Create(s.Name)).ToArray()) };
            var ids = ReqIds(p, "sheet_ids");
            return InTransaction(doc, $"Sheet set {name}", () =>
            {
                var old = existing.FirstOrDefault(s => s.Name == name);
                if (old != null) doc.Delete(old.Id);
                var pm = doc.PrintManager;
                pm.PrintRange = PrintRange.Select;
                var vss = pm.ViewSheetSetting;
                var set = new ViewSet();
                foreach (var id in ids) if (doc.GetElement(id) is ViewSheet s) set.Insert(s);
                vss.CurrentViewSheetSet.Views = set;
                vss.SaveAs(name);
                return new JsonObject { ["name"] = name, ["sheets"] = set.Size };
            });
        }

        private static JsonNode ExportSheetsPdf(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "sheet_ids");
            var folder = ReqStr(p, "folder");
            Directory.CreateDirectory(folder);
            var options = new PDFExportOptions { FileName = ReqStr(p, "file_name"), Combine = true, ZoomType = ZoomType.Zoom, ZoomPercentage = 100, PaperPlacement = PaperPlacementType.Center, HideCropBoundaries = true, HideScopeBoxes = true, ColorDepth = ColorDepthType.Color };
            var done = doc.Export(folder, ids.ToList(), options);
            return new JsonObject { ["exported"] = done };
        }

        /// <summary>Exports each sheet to its own DWG named by sheet number: views merged into the sheet (no xrefs), mm, AutoCAD 2018.
        /// Clean-up for manufacturing (join to polylines, purge) is done afterwards with AutoCAD core console.</summary>
        private static JsonNode ExportSheetsDwg(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var ids = ReqIds(p, "sheet_ids");
            var folder = ReqStr(p, "folder");
            Directory.CreateDirectory(folder);
            var options = new DWGExportOptions
            {
                MergedViews = true,
                FileVersion = ACADVersion.R2018,
                TargetUnit = ExportUnit.Millimeter,
                SharedCoords = false,
                HideScopeBox = true,
                HideReferencePlane = true,
                HideUnreferenceViewTags = true,
                Colors = ExportColorMode.TrueColorPerView,
                ExportOfSolids = SolidGeometry.Polymesh,
            };
            var files = new JsonArray();
            foreach (var id in ids)
            {
                // a sheet exports on paper; any other view exports alone at true size (1:1 mm), for CAD work
                var view = doc.GetElement(id) as View ?? throw new ArgumentException($"{id} is not a sheet or view.");
                var sheet = view as ViewSheet;
                var name = string.Join("_", (sheet != null ? $"{sheet.SheetNumber} {sheet.Name}" : view.Name).Split(Path.GetInvalidFileNameChars()));
                var ok = doc.Export(folder, name, new List<ElementId> { id }, options);
                files.Add(new JsonObject { ["sheet"] = sheet?.SheetNumber ?? view.Name, ["file"] = Path.Combine(folder, name + ".dwg"), ["ok"] = ok });
            }
            return new JsonObject { ["files"] = files };
        }

        /// <summary>Changes the category of an instance's family, for example to one that sections can cut, and reloads it.</summary>
        private static JsonNode SetFamilyCategory(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
            var familyDoc = doc.EditFamily(instance.Symbol.Family);
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Family category"))
                {
                    transaction.Start();
                    familyDoc.OwnerFamily.FamilyCategory = ResolveCategory(familyDoc, ReqStr(p, "category"));
                    transaction.Commit();
                }
                var saveDir = Str(p, "save_dir");
                if (saveDir != null) familyDoc.SaveAs(Path.Combine(saveDir, instance.Symbol.Family.Name + ".rfa"), new SaveAsOptions { OverwriteExistingFile = true });
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["category"] = familyDoc.OwnerFamily.FamilyCategory.Name };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        /// <summary>Draws a revision cloud on a view or sheet around a closed outline of points, tied to a revision.</summary>
        private static JsonNode CreateRevisionCloud(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var revision = ReqId(p, "revision_id");
            var points = (p["points"] as JsonArray ?? throw new ArgumentException("points is required.")).Select(ToPoint).ToList();
            if (points.Count < 3) throw new ArgumentException("points needs at least 3 points.");
            var curves = new List<Curve>();
            for (var k = 0; k < points.Count; k++) curves.Add(Line.CreateBound(points[k], points[(k + 1) % points.Count]));
            return InTransaction(doc, "Revision cloud", () =>
            {
                var cloud = RevisionCloud.Create(doc, view, revision, curves);
                var comments = Str(p, "comments");
                if (comments != null) cloud.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                return new JsonObject { ["id"] = cloud.Id.Value };
            });
        }

        /// <summary>Creates a 3D view looking from eye to target, cut by an optional section box. Replaces a view of the same name.</summary>
        private static JsonNode Create3DView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var eye = ReqPoint(p, "eye");
            var target = ReqPoint(p, "target");
            var perspective = p["perspective"]?.GetValue<bool>() == true;
            var type = new FilteredElementCollector(doc).OfClass(typeof(ViewFamilyType)).Cast<ViewFamilyType>()
                           .FirstOrDefault(t => t.ViewFamily == ViewFamily.ThreeDimensional)
                       ?? throw new InvalidOperationException("The model has no 3D view type.");
            return InTransaction(doc, $"3D view {name}", () =>
            {
                var old = new FilteredElementCollector(doc).OfClass(typeof(View3D)).Cast<View3D>().FirstOrDefault(v => !v.IsTemplate && v.Name == name);
                if (old != null) doc.Delete(old.Id);
                var view = perspective ? View3D.CreatePerspective(doc, type.Id) : View3D.CreateIsometric(doc, type.Id);
                view.Name = name;
                var forward = (target - eye).Normalize();
                // Up is square to forward and as close to world Z as it can be.
                var right = forward.CrossProduct(XYZ.BasisZ);
                var up = right.IsZeroLength() ? XYZ.BasisY : right.CrossProduct(forward).Normalize();
                view.SetOrientation(new ViewOrientation3D(eye, up, forward));
                if (p["box_min"] != null && p["box_max"] != null)
                {
                    view.SetSectionBox(new BoundingBoxXYZ { Min = ReqPoint(p, "box_min"), Max = ReqPoint(p, "box_max") });
                    view.IsSectionBoxActive = true;
                    // Hide the box outline itself.
                    var box = new FilteredElementCollector(doc, view.Id).OfCategory(BuiltInCategory.OST_SectionBox).FirstElementId();
                    if (box != null && box != ElementId.InvalidElementId && doc.GetElement(box).CanBeHidden(view)) view.HideElements(new List<ElementId> { box });
                }
                if (Str(p, "style") is string s && Enum.TryParse<DisplayStyle>(s, true, out var style)) view.DisplayStyle = style;
                return new JsonObject { ["id"] = view.Id.Value, ["name"] = view.Name };
            });
        }

        /// <summary>Turns an existing 3D view in place (keeps its name, sheets, section box and settings).
        /// eye_direction: plain vector from the target toward the camera, e.g. {x:-0.5,y:-0.86,z:0.58} (not mm);
        /// target defaults to the section box centre. Only the orientation changes.</summary>
        private static JsonNode Set3DOrientation(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View3D ?? throw new ArgumentException("view_id is not a 3D view.");
            var d = p["eye_direction"] as JsonObject ?? throw new ArgumentException("eye_direction is required.");
            var dir = new XYZ(d["x"]?.GetValue<double>() ?? 0, d["y"]?.GetValue<double>() ?? 0, d["z"]?.GetValue<double>() ?? 0);
            if (dir.IsZeroLength()) throw new ArgumentException("eye_direction is zero.");
            dir = dir.Normalize();
            var o = view.GetOrientation();
            XYZ target;
            if (p["target"] != null) target = ReqPoint(p, "target");
            else if (view.IsSectionBoxActive) { var b = view.GetSectionBox(); target = b.Transform.OfPoint((b.Min + b.Max) / 2); }
            else target = o.EyePosition + o.ForwardDirection * 30;
            var dist = (o.EyePosition - target).GetLength();
            if (dist < 1) dist = 40;
            var eye = target + dir * dist;
            var forward = (target - eye).Normalize();
            var right = forward.CrossProduct(XYZ.BasisZ);
            var up = right.IsZeroLength() ? XYZ.BasisY : right.CrossProduct(forward).Normalize();
            return InTransaction(doc, $"Turn 3D view {view.Name}", () =>
            {
                if (view.IsLocked) view.Unlock();
                view.SetOrientation(new ViewOrientation3D(eye, up, forward));
                var f = view.GetOrientation().ForwardDirection;
                return new JsonObject { ["id"] = view.Id.Value, ["name"] = view.Name,
                    ["view_direction"] = new JsonObject { ["x"] = -f.X, ["y"] = -f.Y, ["z"] = -f.Z } };
            });
        }

        /// <summary>Hides everything in a view except the given elements, permanently, so the view shows one unit alone.</summary>
        private static JsonNode IsolateInView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var keep = new HashSet<ElementId>(ReqIds(p, "element_ids"));
            return InTransaction(doc, "Isolate in view", () =>
            {
                var others = new FilteredElementCollector(doc, view.Id).WhereElementIsNotElementType().ToElements()
                    .Where(e => !keep.Contains(e.Id) && e.Category != null && e.CanBeHidden(view) && e.Category.Id.Value != (long)BuiltInCategory.OST_Viewers)
                    .Select(e => e.Id).ToList();
                if (others.Count > 0) view.HideElements(others);
                return new JsonObject { ["hidden"] = others.Count };
            });
        }

        /// <summary>Replaces text in every text note (optionally one view's only): pairs [{find, replace}], applied in order. Returns the views changed.</summary>
        private static JsonNode ReplaceText(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewId = OptId(p, "view_id");
            var pairs = (p["pairs"] as JsonArray ?? throw new ArgumentException("pairs is required.")).Select(n => (ReqStr(n.AsObject(), "find"), Str(n.AsObject(), "replace") ?? "")).ToList();
            var dryRun = p["dry_run"]?.GetValue<bool>() ?? false;
            var notes = (viewId != null ? new FilteredElementCollector(doc, viewId) : new FilteredElementCollector(doc)).OfClass(typeof(TextNote)).Cast<TextNote>().ToList();
            var changed = new JsonArray();
            void Run()
            {
                foreach (var t in notes)
                {
                    var text = t.Text; var next = text;
                    foreach (var (find, replace) in pairs) next = next.Replace(find, replace);
                    if (next == text) continue;
                    if (!dryRun) t.Text = next;
                    var owner = doc.GetElement(t.OwnerViewId) as View;
                    changed.Add(new JsonObject { ["id"] = t.Id.Value, ["view"] = owner?.Name, ["sheet_number"] = (owner as ViewSheet)?.SheetNumber });
                }
            }
            if (dryRun) { Run(); return new JsonObject { ["changed"] = changed, ["dry_run"] = true }; }
            return InTransaction(doc, "Replace text", () => { Run(); return new JsonObject { ["changed"] = changed }; });
        }

        /// <summary>Hides the given elements in a view, or shows them again with unhide: true. Elements that cannot be hidden are skipped.</summary>
        private static JsonNode HideElementsInView(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var unhide = p["unhide"]?.GetValue<bool>() ?? false;
            var ids = ReqIds(p, "element_ids").Where(id => doc.GetElement(id) is Element e && (unhide || e.CanBeHidden(view))).ToList();
            return InTransaction(doc, unhide ? "Unhide elements" : "Hide elements", () =>
            {
                if (ids.Count > 0) { if (unhide) view.UnhideElements(ids); else view.HideElements(ids); }
                return new JsonObject { [unhide ? "shown" : "hidden"] = ids.Count };
            });
        }

        /// <summary>Isolates elements in a view by Mark with a rule-based view filter: everything whose Mark is none of the given marks
        /// is hidden, including elements added later, so isolated unit views stay clean after model changes.</summary>
        private static JsonNode IsolateByMark(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var marks = (p["marks"] as JsonArray ?? throw new ArgumentException("marks is required.")).Select(n => n.GetValue<string>()).ToList();
            if (marks.Count == 0) throw new ArgumentException("marks is empty.");
            var markId = new ElementId(BuiltInParameter.ALL_MODEL_MARK);
            var cats = ParameterFilterUtilities.GetAllFilterableCategories()
                .Where(c => ParameterFilterUtilities.GetFilterableParametersInCommon(doc, new List<ElementId> { c }).Contains(markId)).ToList();
            var name = ReqStr(p, "filter_name");
            return InTransaction(doc, "Isolate by Mark", () =>
            {
                var rules = marks.Select(m => (FilterRule)ParameterFilterRuleFactory.CreateNotEqualsRule(markId, m)).ToList();
                var filter = new ElementParameterFilter(rules);
                var pfe = new FilteredElementCollector(doc).OfClass(typeof(ParameterFilterElement)).Cast<ParameterFilterElement>().FirstOrDefault(f => f.Name == name);
                if (pfe == null) pfe = ParameterFilterElement.Create(doc, name, cats, filter);
                else { pfe.SetCategories(cats); pfe.SetElementFilter(filter); }
                if (!view.GetFilters().Contains(pfe.Id)) view.AddFilter(pfe.Id);
                view.SetFilterVisibility(pfe.Id, false);
                return new JsonObject { ["filter_id"] = pfe.Id.Value, ["categories"] = cats.Count, ["marks"] = marks.Count };
            });
        }

        /// <summary>Adds a keynote: text at a point with a leader to another point.</summary>
        private static JsonNode CreateKeynote(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var at = OnViewPlane(view, ReqPoint(p, "at"));
            var to = OnViewPlane(view, ReqPoint(p, "to"));
            return InTransaction(doc, "Create keynote", () =>
            {
                var typeId = OptId(p, "text_type_id") ?? doc.GetDefaultElementTypeId(ElementTypeGroup.TextNoteType);
                var note = TextNote.Create(doc, view.Id, at, ReqStr(p, "text"), typeId);
                var side = view.RightDirection.DotProduct(to - at) >= 0 ? TextNoteLeaderTypes.TNLT_STRAIGHT_R : TextNoteLeaderTypes.TNLT_STRAIGHT_L;
                var leader = note.AddLeader(side);
                leader.End = to;
                return new JsonObject { ["id"] = note.Id.Value };
            });
        }

        /// <summary>Gives a viewport a type that shows no title, creating the type if needed.</summary>
        private static JsonNode SetViewportNoTitle(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var viewport = RequireElement(doc, ReqId(p, "viewport_id")) as Viewport ?? throw new ArgumentException("viewport_id is not a viewport.");
            return InTransaction(doc, "Viewport no title", () =>
            {
                var current = (ElementType)doc.GetElement(viewport.GetTypeId());
                var noTitle = new FilteredElementCollector(doc).OfClass(typeof(ElementType)).Cast<ElementType>()
                    .FirstOrDefault(t => t.FamilyName == current.FamilyName && t.Name == "No Title");
                if (noTitle == null)
                {
                    noTitle = current.Duplicate("No Title");
                    noTitle.get_Parameter(BuiltInParameter.VIEWPORT_ATTR_SHOW_LABEL)?.Set(0);
                }
                viewport.ChangeTypeId(noTitle.Id);
                return new JsonObject { ["type_id"] = noTitle.Id.Value };
            });
        }

        /// <summary>Sets a view's phase filter by name.</summary>
        private static JsonNode SetPhaseFilter(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var view = RequireElement(doc, ReqId(p, "view_id")) as View ?? throw new ArgumentException("view_id is not a view.");
            var name = ReqStr(p, "name");
            var filter = new FilteredElementCollector(doc).OfClass(typeof(PhaseFilter)).FirstOrDefault(f => f.Name == name)
                ?? throw new ArgumentException($"No phase filter named '{name}'.");
            return InTransaction(doc, "Set phase filter", () =>
            {
                view.get_Parameter(BuiltInParameter.VIEW_PHASE_FILTER).Set(filter.Id);
                return new JsonObject { ["view"] = view.Name, ["filter"] = filter.Name };
            });
        }

        /// <summary>Takes a horizontal band out of a solid: what is below stays, what is above drops by the band's height.</summary>
        private static List<Solid> WithoutBand(Solid solid, double z0, double z1)
        {
            var box = solid.GetBoundingBox();
            var bottom = box.Transform.OfPoint(box.Min).Z;
            var top = box.Transform.OfPoint(box.Max).Z;
            const double tolerance = 1e-6;
            var drop = Transform.CreateTranslation(new XYZ(0, 0, z0 - z1));
            if (top <= z0 + tolerance) return new List<Solid> { solid };
            if (bottom >= z1 - tolerance) return new List<Solid> { SolidUtils.CreateTransformed(solid, drop) };
            var pieces = new List<Solid>();
            if (bottom < z0 - tolerance)
            {
                var below = BooleanOperationsUtils.CutWithHalfSpace(solid, Plane.CreateByNormalAndOrigin(-XYZ.BasisZ, new XYZ(0, 0, z0)));
                if (below != null && below.Volume > 0) pieces.Add(below);
            }
            if (top > z1 + tolerance)
            {
                var above = BooleanOperationsUtils.CutWithHalfSpace(solid, Plane.CreateByNormalAndOrigin(XYZ.BasisZ, new XYZ(0, 0, z1)));
                if (above != null && above.Volume > 0) pieces.Add(SolidUtils.CreateTransformed(above, drop));
            }
            // The two pieces meet face to face after the drop: join them, so a panel stays one part (no joint on shop drawings).
            if (pieces.Count == 2)
            {
                try
                {
                    var joined = BooleanOperationsUtils.ExecuteBooleanOperation(pieces[0], pieces[1], BooleanOperationsType.Union);
                    if (joined != null && Math.Abs(joined.Volume - pieces[0].Volume - pieces[1].Volume) < 1e-6 * Math.Max(1, joined.Volume) + 1e-9)
                        return new List<Solid> { joined };
                }
                catch { /* keep the two pieces */ }
            }
            return pieces;
        }

        /// <summary>Joins the touching free-form solids of one material in a loaded family into single solids (for example the two
        /// pieces an older remove_z_band left), then reloads the family. Optional form_ids limits it to those forms.</summary>
        private static JsonNode JoinFamilySolids(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var instance = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
            var only = p["form_ids"] is JsonArray ids ? ids.Select(n => n.GetValue<long>()).ToHashSet() : null;
            var options = new Options { DetailLevel = ViewDetailLevel.Fine };
            var familyDoc = doc.EditFamily(instance.Symbol.Family);
            try
            {
                int before = 0, after = 0;
                using (var transaction = new Transaction(familyDoc, "MCP: Join solids"))
                {
                    transaction.Start();
                    var forms = new FilteredElementCollector(familyDoc).OfClass(typeof(FreeFormElement)).Cast<FreeFormElement>()
                        .Where(f => only == null || only.Contains(f.Id.Value)).ToList();
                    foreach (var group in forms.GroupBy(f => f.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.AsElementId()?.Value ?? -1))
                    {
                        var items = group.Select(f => (form: f, solid: SolidsOf(f.get_Geometry(options)).FirstOrDefault())).Where(x => x.solid != null).ToList();
                        before += items.Count;
                        var merged = items.Select(x => (forms: new List<FreeFormElement> { x.form }, solid: x.solid)).ToList();
                        bool changed = true;
                        while (changed)
                        {
                            changed = false;
                            for (int i = 0; i < merged.Count && !changed; i++)
                                for (int j = i + 1; j < merged.Count && !changed; j++)
                                {
                                    Solid u = null;
                                    try { u = BooleanOperationsUtils.ExecuteBooleanOperation(merged[i].solid, merged[j].solid, BooleanOperationsType.Union); } catch { }
                                    // touching only: the union keeps both volumes and is one connected piece
                                    if (u == null || Math.Abs(u.Volume - merged[i].solid.Volume - merged[j].solid.Volume) > 1e-6 * Math.Max(1, u.Volume) + 1e-9) continue;
                                    if (SolidUtils.SplitVolumes(u).Count != 1) continue;
                                    merged[i] = (merged[i].forms.Concat(merged[j].forms).ToList(), u);
                                    merged.RemoveAt(j);
                                    changed = true;
                                }
                        }
                        var material = group.Key;
                        foreach (var m in merged)
                        {
                            after++;
                            if (m.forms.Count == 1) continue;
                            foreach (var f in m.forms) familyDoc.Delete(f.Id);
                            var created = FreeFormElement.Create(familyDoc, m.solid);
                            if (material != -1) created.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(new ElementId(material));
                        }
                    }
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["solids_before"] = before, ["solids_after"] = after };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        /// <summary>Shortens a direct shape or a family's solids by removing a band between two project heights. Everything above the band drops.</summary>
        private static JsonNode RemoveZBand(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var element = RequireElement(doc, ReqId(p, "element_id"));
            var z0 = FromMm(ReqNum(p, "z0_mm"));
            var z1 = FromMm(ReqNum(p, "z1_mm"));
            if (z1 <= z0) throw new ArgumentException("z1_mm must be above z0_mm.");
            var options = new Options { DetailLevel = ViewDetailLevel.Fine };

            if (element is DirectShape shape)
            {
                var before = SolidsOf(shape.get_Geometry(options)).ToList();
                return InTransaction(doc, "Remove band", () =>
                {
                    var after = before.SelectMany(s => WithoutBand(s, z0, z1)).Cast<GeometryObject>().ToList();
                    if (after.Count == 0) throw new ArgumentException("The band removes the whole element.");
                    shape.SetShape(after);
                    return new JsonObject { ["solids_before"] = before.Count, ["solids_after"] = after.Count };
                });
            }

            var instance = element as FamilyInstance ?? throw new ArgumentException("element_id is neither a direct shape nor a family instance.");
            var originZ = ((LocationPoint)instance.Location).Point.Z;
            var familyDoc = doc.EditFamily(instance.Symbol.Family);
            try
            {
                int before = 0, after = 0;
                using (var transaction = new Transaction(familyDoc, "MCP: Remove band"))
                {
                    transaction.Start();
                    var forms = new FilteredElementCollector(familyDoc).OfClass(typeof(FreeFormElement)).Cast<FreeFormElement>().ToList();
                    foreach (var form in forms)
                    {
                        var material = form.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.AsElementId() ?? ElementId.InvalidElementId;
                        var solids = SolidsOf(form.get_Geometry(options)).ToList();
                        before += solids.Count;
                        var replacements = solids.SelectMany(s => WithoutBand(s, z0 - originZ, z1 - originZ)).ToList();
                        familyDoc.Delete(form.Id);
                        foreach (var solid in replacements)
                        {
                            var created = FreeFormElement.Create(familyDoc, solid);
                            if (material != ElementId.InvalidElementId) created.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(material);
                            after++;
                        }
                    }
                    transaction.Commit();
                }
                var saveDir = Str(p, "save_dir");
                if (saveDir != null) familyDoc.SaveAs(Path.Combine(saveDir, instance.Symbol.Family.Name + ".rfa"), new SaveAsOptions { OverwriteExistingFile = true });
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject { ["solids_before"] = before, ["solids_after"] = after };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static int ColorInt(JsonNode node) =>
            node["r"].GetValue<int>() + (node["g"].GetValue<int>() << 8) + (node["b"].GetValue<int>() << 16);

        /// <summary>Restyles a title block family: keeps its labels, replaces all other sheet graphics, saves a copy and loads it.</summary>
        private static JsonNode BuildTitleBlock(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var source = ReqStr(p, "source_rfa");
            if (!File.Exists(source)) throw new ArgumentException($"Family not found: '{source}'.");
            var savePath = ReqStr(p, "save_path");
            var report = new JsonArray();

            var fd = app.Application.OpenDocumentFile(source);
            try
            {
                using (var transaction = new Transaction(fd, "MCP: Title block"))
                {
                    transaction.Start();
                    var labels = new FilteredElementCollector(fd).OfClass(typeof(TextElement)).Cast<TextElement>()
                        .Where(e => !(e is TextNote)).ToList();
                    if (labels.Count == 0) throw new InvalidOperationException("The family has no labels to keep.");
                    var view = (View)fd.GetElement(labels[0].OwnerViewId);
                    var keep = new HashSet<ElementId>(labels.Select(e => e.Id));

                    foreach (var id in new FilteredElementCollector(fd, view.Id).WhereElementIsNotElementType().ToElementIds().ToList())
                    {
                        if (keep.Contains(id) || !fd.GetElement(id).IsValidObject) continue;
                        try { fd.Delete(id); } catch (Autodesk.Revit.Exceptions.ArgumentException) { }
                    }

                    // The source's sheet-edge lines cannot be deleted; for another paper size, reshape them to the new sheet edge.
                    if (p["sheet_size_mm"] is JsonObject sheetSize)
                    {
                        var w = FromMm(sheetSize["w"].GetValue<double>());
                        var h = FromMm(sheetSize["h"].GetValue<double>());
                        var corners = new[] { XYZ.Zero, new XYZ(w, 0, 0), new XYZ(w, h, 0), new XYZ(0, h, 0) };
                        var edges = new FilteredElementCollector(fd, view.Id).OfClass(typeof(CurveElement)).Cast<CurveElement>()
                            .Where(c => !keep.Contains(c.Id) && c.GeometryCurve is Line).ToList();
                        for (var i = 0; i < edges.Count && i < 4; i++)
                            edges[i].SetGeometryCurve(Line.CreateBound(corners[i], corners[(i + 1) % 4]), true);
                        report.Add($"sheet edge {edges.Count} lines set to {sheetSize["w"]} x {sheetSize["h"]} mm");
                    }

                    var textTypes = new Dictionary<string, ElementId>();
                    ElementId TextType(double size, JsonNode color, bool bold, ElementId basis)
                    {
                        var key = $"Samaya {size:0.0} {color?["r"]}-{color?["g"]}-{color?["b"]}{(bold ? " Bold" : "")}";
                        if (textTypes.TryGetValue(key, out var existing)) return existing;
                        var type = (ElementType)((ElementType)fd.GetElement(basis)).Duplicate(key);
                        type.get_Parameter(BuiltInParameter.TEXT_SIZE)?.Set(FromMm(size));
                        type.get_Parameter(BuiltInParameter.TEXT_FONT)?.Set("Arial");
                        type.get_Parameter(BuiltInParameter.TEXT_STYLE_BOLD)?.Set(bold ? 1 : 0);
                        type.get_Parameter(BuiltInParameter.TEXT_BACKGROUND)?.Set(1);
                        if (color != null) type.get_Parameter(BuiltInParameter.LINE_COLOR)?.Set(ColorInt(color));
                        return textTypes[key] = type.Id;
                    }

                    if (p["regions"] is JsonArray regions)
                    {
                        var solid = new FilteredElementCollector(fd).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>()
                            .First(f => f.GetFillPattern().IsSolidFill);
                        var baseRegion = new FilteredElementCollector(fd).OfClass(typeof(FilledRegionType)).Cast<FilledRegionType>().First();
                        foreach (var node in regions)
                        {
                            var o = node.AsObject();
                            var type = (FilledRegionType)baseRegion.Duplicate($"Samaya Fill {ColorInt(o["color"])}-{Guid.NewGuid():N}");
                            type.ForegroundPatternId = solid.Id;
                            type.ForegroundPatternColor = ColorOf(o, "color");
                            type.BackgroundPatternId = ElementId.InvalidElementId;
                            var pts = o["points"].AsArray().Select(ToPoint).ToList();
                            var loop = new CurveLoop();
                            for (var i = 0; i < pts.Count; i++) loop.Append(Line.CreateBound(pts[i], pts[(i + 1) % pts.Count]));
                            FilledRegion.Create(fd, type.Id, view.Id, new[] { loop });
                        }
                    }
                    if (p["lines"] is JsonArray lines)
                    {
                        foreach (var node in lines)
                        {
                            var o = node.AsObject();
                            fd.FamilyCreate.NewDetailCurve(view, Line.CreateBound(ReqPoint(o, "start"), ReqPoint(o, "end")));
                        }
                    }
                    var baseText = new FilteredElementCollector(fd).OfClass(typeof(TextNoteType)).FirstElementId();
                    if (p["texts"] is JsonArray texts)
                    {
                        foreach (var node in texts)
                        {
                            var o = node.AsObject();
                            var options = new TextNoteOptions(TextType(ReqNum(o, "size_mm"), o["color"], Bool(o, "bold"), baseText));
                            if (Str(o, "align") == "center") options.HorizontalAlignment = HorizontalTextAlignment.Center;
                            TextNote.Create(fd, view.Id, ReqPoint(o, "at"), ReqStr(o, "text"), options);
                        }
                    }
                    if (p["images"] is JsonArray images)
                    {
                        foreach (var node in images)
                        {
                            var o = node.AsObject();
                            var type = ImageType.Create(fd, new ImageTypeOptions(ReqStr(o, "path"), false, ImageTypeSource.Import));
                            var image = ImageInstance.Create(fd, view, type.Id, new ImagePlacementOptions(ReqPoint(o, "center"), BoxPlacement.Center));
                            image.Width = FromMm(ReqNum(o, "width_mm"));
                        }
                    }
                    foreach (var node in p["labels"] as JsonArray ?? throw new ArgumentException("labels is required."))
                    {
                        var o = node.AsObject();
                        var match = ReqStr(o, "match");
                        var label = labels.FirstOrDefault(e => e.Text.Trim() == match);
                        if (label == null) { report.Add($"label not found: {match}"); continue; }
                        var at = ReqPoint(o, "at");
                        ElementTransformUtils.MoveElement(fd, label.Id, new XYZ(at.X - label.Coord.X, at.Y - label.Coord.Y, 0));
                        label.ChangeTypeId(TextType(ReqNum(o, "size_mm"), o["color"], Bool(o, "bold"), label.GetTypeId()));
                        labels.Remove(label);
                    }
                    foreach (var unused in labels) report.Add($"label left in place: {unused.Text.Trim()}");
                    transaction.Commit();
                }
                Directory.CreateDirectory(Path.GetDirectoryName(savePath));
                fd.SaveAs(savePath, new SaveAsOptions { OverwriteExistingFile = true });
                var family = fd.LoadFamily(doc, new OverwriteFamily());
                return new JsonObject
                {
                    ["family"] = family.Name,
                    ["family_id"] = family.Id.Value,
                    ["types"] = new JsonArray(family.GetFamilySymbolIds().Select(id => (JsonNode)id.Value).ToArray()),
                    ["report"] = report,
                };
            }
            finally
            {
                fd.Close(false);
            }
        }

        private static JsonNode CutWithVoids(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var host = RequireElement(doc, ReqId(p, "host_id"));
            var symbol = RequireElement(doc, ReqId(p, "family_type_id")) as FamilySymbol
                         ?? throw new ArgumentException("family_type_id is not a family type.");
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var points = (p["points"] as JsonArray ?? throw new ArgumentException("points is required.")).Select(ToPoint).ToList();
            return InTransaction(doc, $"Cut {host.Name}", () =>
            {
                if (!symbol.IsActive)
                {
                    symbol.Activate();
                    doc.Regenerate();
                }
                var ids = new JsonArray();
                foreach (var point in points)
                {
                    var instance = doc.Create.NewFamilyInstance(new XYZ(point.X, point.Y, level.Elevation), symbol, level, StructuralType.NonStructural);
                    doc.Regenerate();
                    InstanceVoidCutUtils.AddInstanceVoidCut(doc, host, instance);
                    ids.Add(instance.Id.Value);
                }
                return new JsonObject { ["cuts"] = ids.Count, ["void_ids"] = ids };
            });
        }

        private static JsonNode ExtractNestedFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var host = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                       ?? throw new ArgumentException("element_id is not a family instance.");
            var nestedName = ReqStr(p, "nested_family");
            var hostZ = host.GetTransform().Origin.Z;
            var level = (OptId(p, "level_id") is ElementId levelId ? RequireLevel(doc, levelId) : doc.GetElement(LevelIdOf(host)) as Level)
                        ?? new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>()
                            .OrderBy(l => Math.Abs(l.Elevation - hostZ)).FirstOrDefault()
                        ?? throw new InvalidOperationException("The model has no level.");
            var symbol = new FilteredElementCollector(doc).OfClass(typeof(FamilySymbol)).Cast<FamilySymbol>()
                             .FirstOrDefault(s => s.Family.Name == nestedName)
                         ?? throw new InvalidOperationException($"Family '{nestedName}' is not loaded in the project.");
            var hostTransform = host.GetTransform();

            // Place the copy first, so a failure can never lose the fridge from the model.
            var familyDoc = doc.EditFamily(host.Symbol.Family);
            try
            {
                var nested = new FilteredElementCollector(familyDoc).OfClass(typeof(FamilyInstance)).Cast<FamilyInstance>()
                                 .FirstOrDefault(i => i.Symbol.Family.Name == nestedName)
                             ?? throw new ArgumentException($"No nested '{nestedName}' in this family.");
                var transform = nested.GetTransform();
                var point = hostTransform.OfPoint(transform.Origin);
                var axis = hostTransform.OfVector(transform.BasisX);
                var placed = InTransaction(doc, $"Place {nestedName}", () =>
                {
                    if (!symbol.IsActive)
                    {
                        symbol.Activate();
                        doc.Regenerate();
                    }
                    var instance = doc.Create.NewFamilyInstance(point, symbol, level, StructuralType.NonStructural);
                    doc.Regenerate();
                    var angle = Math.Atan2(axis.Y, axis.X);
                    if (Math.Abs(angle) > 1e-6)
                        ElementTransformUtils.RotateElement(doc, instance.Id, Line.CreateBound(point, point + XYZ.BasisZ), angle);
                    return new JsonObject { ["id"] = instance.Id.Value, ["family"] = symbol.FamilyName, ["type"] = symbol.Name };
                });
                using (var transaction = new Transaction(familyDoc, "MCP: Remove nested family"))
                {
                    transaction.Start();
                    familyDoc.Delete(nested.Id);
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
                return placed;
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static JsonNode SetFamilyMaterial(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var name = ReqStr(p, "material");
            var color = ColorOf(p, "color");
            var only = (p["form_ids"] as JsonArray)?.Select(n => n.GetValue<long>()).ToHashSet();
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            var changed = 0;
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Set family material"))
                {
                    transaction.Start();
                    var material = new FilteredElementCollector(familyDoc).OfClass(typeof(Material)).Cast<Material>().FirstOrDefault(m => m.Name == name)
                                   ?? (Material)familyDoc.GetElement(Material.Create(familyDoc, name));
                    material.Color = color;
                    foreach (var form in new FilteredElementCollector(familyDoc).OfClass(typeof(GenericForm)).Cast<GenericForm>())
                    {
                        if (only != null && !only.Contains(form.Id.Value)) continue;
                        var parameter = form.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM);
                        if (parameter == null || parameter.IsReadOnly) continue;
                        parameter.Set(material.Id);
                        changed++;
                    }
                    transaction.Commit();
                }
                if (changed > 0) familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }
            return new JsonObject { ["changed"] = changed, ["material"] = name };
        }

        /// <summary>Edits a loaded family's solids: deletes forms by id and adds box solids (family coordinates, mm) with a material, then reloads it.</summary>
        private static JsonNode EditFamilySolids(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var remove = (p["delete_form_ids"] as JsonArray)?.Select(n => new ElementId(n.GetValue<long>())).ToList() ?? new List<ElementId>();
            var boxes = p["add"] as JsonArray ?? new JsonArray();
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            var added = new JsonArray();
            string? cutNotes = null;
            try
            {
                using (var transaction = new Transaction(familyDoc, "MCP: Edit family solids"))
                {
                    transaction.Start();
                    if (remove.Count > 0) familyDoc.Delete(remove);
                    // move: [{ "ids": [form ids], "dx_mm": 0, "dy_mm": 0, "dz_mm": 145 }] - shifts forms inside the family.
                    if (p["move"] is JsonArray moves)
                        foreach (var node in moves)
                        {
                            var o = node.AsObject();
                            var ids = (o["ids"] as JsonArray ?? new JsonArray()).Select(n => new ElementId(n.GetValue<long>())).ToList();
                            var delta = new XYZ(FromMm(Num(o, "dx_mm") ?? 0), FromMm(Num(o, "dy_mm") ?? 0), FromMm(Num(o, "dz_mm") ?? 0));
                            if (ids.Count > 0) ElementTransformUtils.MoveElements(familyDoc, ids, delta);
                        }
                    foreach (var node in boxes)
                    {
                        var o = node.AsObject();
                        var name = ReqStr(o, "material");
                        var material = new FilteredElementCollector(familyDoc).OfClass(typeof(Material)).Cast<Material>().FirstOrDefault(m => m.Name == name)
                                       ?? (Material)familyDoc.GetElement(Material.Create(familyDoc, name));
                        if (o["color"] != null) material.Color = ColorOf(o, "color");
                        // direction + length_mm: "profile" is a closed 3D outline [{x,y,z},...] in mm on a plane square to
                        // direction, extruded length_mm along it (e.g. an upright CNC arch former running front to back).
                        if (o["direction"] != null && o["profile"] is JsonArray p3 && p3.Count >= 3)
                        {
                            var dir = ToPoint(o["direction"]).Normalize();
                            var pts = p3.Select(ToPoint).ToArray();
                            var loop3 = new CurveArray();
                            for (var k = 0; k < pts.Length; k++) loop3.Append(Line.CreateBound(pts[k], pts[(k + 1) % pts.Length]));
                            var prof3 = new CurveArrArray();
                            prof3.Append(loop3);
                            // "holes": inner loops [[{x,y,z},...],...] on the same plane, e.g. shelf-pin holes in a lining
                            if (o["holes"] is JsonArray hl)
                                foreach (var h in hl.OfType<JsonArray>())
                                {
                                    var hp = h.Select(ToPoint).ToArray(); if (hp.Length < 3) continue;
                                    var hloop = new CurveArray();
                                    for (var k = 0; k < hp.Length; k++) hloop.Append(Line.CreateBound(hp[k], hp[(k + 1) % hp.Length]));
                                    prof3.Append(hloop);
                                }
                            // "circles": [{x,y,z,r}] round holes on the profile plane, each as two true arcs (few segments,
                            // no "sketches with many segments" warning: Madina 2 shelf-pin matrix, 11 Nov 2026)
                            if (o["circles"] is JsonArray cl)
                                foreach (var ci in cl.OfType<JsonObject>())
                                {
                                    var cc = ToPoint(ci); var rr = FromMm(ReqNum(ci, "r"));
                                    var ux = dir.CrossProduct(Math.Abs(dir.Z) < 0.9 ? XYZ.BasisZ : XYZ.BasisX).Normalize();
                                    var uy = dir.CrossProduct(ux).Normalize();
                                    var cloop = new CurveArray();
                                    cloop.Append(Arc.Create(cc + ux * rr, cc - ux * rr, cc + uy * rr));
                                    cloop.Append(Arc.Create(cc - ux * rr, cc + ux * rr, cc - uy * rr));
                                    prof3.Append(cloop);
                                }
                            var sp = SketchPlane.Create(familyDoc, Plane.CreateByNormalAndOrigin(dir, pts[0]));
                            // "void": true cuts instead of adds (e.g. horizontal shelf-pin holes through an arch skin)
                            var isVoid = o["void"] != null && o["void"]!.GetValue<bool>();
                            var ext3 = familyDoc.FamilyCreate.NewExtrusion(!isVoid, prof3, sp, FromMm(ReqNum(o, "length_mm")));
                            if (!isVoid) ext3.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(material.Id);
                            added.Add(ext3.Id.Value);
                            continue;
                        }
                        var min = ReqPoint(o, "min");
                        var max = ReqPoint(o, "max");
                        var loop = new CurveArray();
                        var c = new[] { new XYZ(min.X, min.Y, min.Z), new XYZ(max.X, min.Y, min.Z), new XYZ(max.X, max.Y, min.Z), new XYZ(min.X, max.Y, min.Z) };
                        // profile: optional plan outline [{x,y},...] in mm, extruded from min.z to max.z (e.g. a mitred
                        // plinth rail, a trapezoid); min/max x,y are then ignored.
                        if (o["profile"] is JsonArray prof && prof.Count >= 3)
                            c = prof.Select(n => { var q = ToPoint(n); return new XYZ(q.X, q.Y, min.Z); }).ToArray();
                        for (var k = 0; k < c.Length; k++) loop.Append(Line.CreateBound(c[k], c[(k + 1) % c.Length]));
                        var profile = new CurveArrArray();
                        profile.Append(loop);
                        var plane = SketchPlane.Create(familyDoc, Plane.CreateByNormalAndOrigin(XYZ.BasisZ, new XYZ(0, 0, min.Z)));
                        var extrusion = familyDoc.FamilyCreate.NewExtrusion(true, profile, plane, max.Z - min.Z);
                        extrusion.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.Set(material.Id);
                        added.Add(extrusion.Id.Value);
                    }
                    // "cut_voids": true makes every void form cut the solid forms its box meets. A void made through the
                    // API does not cut other forms by itself (shelf-pin holes through an arch skin, 11 Nov 2026).
                    if (p["cut_voids"] != null && p["cut_voids"]!.GetValue<bool>())
                    {
                        var forms = new FilteredElementCollector(familyDoc).OfClass(typeof(GenericForm)).Cast<GenericForm>().ToList();
                        var voids = forms.Where(f => !f.IsSolid).ToList();
                        var solidsF = forms.Where(f => f.IsSolid).ToList();
                        var cuts = 0; var whyNot = new List<string>();
                        foreach (var v in voids)
                        {
                            var vb = v.get_BoundingBox(null); if (vb == null) continue;
                            foreach (var s in solidsF)
                            {
                                var sb = s.get_BoundingBox(null); if (sb == null) continue;
                                if (vb.Max.X < sb.Min.X || vb.Min.X > sb.Max.X || vb.Max.Y < sb.Min.Y || vb.Min.Y > sb.Max.Y || vb.Max.Z < sb.Min.Z || vb.Min.Z > sb.Max.Z) continue;
                                try
                                {
                                    if (SolidSolidCutUtils.CutExistsBetweenElements(s, v, out _)) continue;
                                    if (SolidSolidCutUtils.CanElementCutElement(v, s, out var why)) { SolidSolidCutUtils.AddCutBetweenSolids(familyDoc, s, v); cuts++; }
                                    else if (whyNot.Count < 5) whyNot.Add($"{s.GetType().Name} {s.Id}: {why}");
                                }
                                catch (Exception ex) { if (whyNot.Count < 5) whyNot.Add($"{s.Id}: {ex.Message}"); }
                            }
                        }
                        added.Add(-cuts);
                        cutNotes = string.Join(" | ", whyNot) + $" (voids {voids.Count}, solids {solidsF.Count})";
                    }
                    transaction.Commit();
                }
                familyDoc.LoadFamily(doc, new OverwriteFamily());
            }
            finally
            {
                familyDoc.Close(false);
            }
            return new JsonObject { ["deleted"] = remove.Count, ["added"] = added, ["cut_notes"] = cutNotes };
        }

        private static void CollectSolids(GeometryElement geometry, List<Solid> solids)
        {
            foreach (var item in geometry)
            {
                if (item is Solid solid && solid.Volume > 1e-9) solids.Add(solid);
                else if (item is GeometryInstance instance) CollectSolids(instance.GetInstanceGeometry(), solids);
            }
        }

        private static JsonNode CopyInstanceScaled(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var source = RequireElement(doc, ReqId(p, "element_id"));
            var category = ResolveCategory(doc, ReqStr(p, "category"));
            var name = ReqStr(p, "name");
            var scale = ReqNum(p, "scale");
            var target = ReqPoint(p, "center");
            var comments = Str(p, "comments");

            var solids = new List<Solid>();
            CollectSolids(source.get_Geometry(new Options { DetailLevel = ViewDetailLevel.Fine }), solids);
            if (solids.Count == 0) throw new InvalidOperationException("The source has no solid geometry.");

            var points = solids.SelectMany(s => s.Edges.Cast<Edge>()).SelectMany(e => e.Tessellate()).ToList();
            var min = new XYZ(points.Min(q => q.X), points.Min(q => q.Y), points.Min(q => q.Z));
            var max = new XYZ(points.Max(q => q.X), points.Max(q => q.Y), points.Max(q => q.Z));
            var center = (min + max) / 2;
            var transform = Transform.CreateTranslation(target)
                .Multiply(Transform.Identity.ScaleBasis(scale))
                .Multiply(Transform.CreateTranslation(-center));
            var copies = solids.Select(s => (GeometryObject)SolidUtils.CreateTransformed(s, transform)).ToList();

            return InTransaction(doc, $"Create {name}", () =>
            {
                var shape = DirectShape.CreateElement(doc, category.Id);
                shape.SetShape(copies);
                shape.Name = name;
                if (comments != null) shape.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                var size = max - min;
                return new JsonObject
                {
                    ["id"] = shape.Id.Value,
                    ["solids"] = copies.Count,
                    ["source_size_mm"] = new JsonObject { ["x"] = ToMm(size.X), ["y"] = ToMm(size.Y), ["z"] = ToMm(size.Z) },
                };
            });
        }

        /// <summary>
        /// Exact extrusion profiles of an instance's family solids, in family coordinates (same frame as inspect_family):
        /// per solid its material, extrusion direction, length and the start cap's loops (outer + holes, curves tessellated).
        /// Lets a tool rebuild curved board parts exactly instead of from bounding boxes (user, 11 Nov 2026). Solids that are
        /// not prisms come back with "prism": false and their bounding box only.
        /// </summary>
        private static JsonNode FamilySolidProfiles(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            if (!target.Symbol.Family.IsEditable) throw new InvalidOperationException("This family cannot be edited.");
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var outSolids = new JsonArray();
                foreach (var e in new FilteredElementCollector(familyDoc).WhereElementIsNotElementType().Where(x => x is GenericForm))
                {
                    var matName = familyDoc.GetElement(e.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.AsElementId() ?? ElementId.InvalidElementId)?.Name;
                    var geo = e.get_Geometry(new Options { ComputeReferences = false, DetailLevel = ViewDetailLevel.Fine });
                    if (geo == null) continue;
                    foreach (var solid in geo.OfType<Solid>().Where(s => s.Volume > 1e-9))
                    {
                        var faces = solid.Faces.Cast<Face>().ToList();
                        PlanarFace best = null, other = null; double bestArea = -1;
                        foreach (var f in faces.OfType<PlanarFace>())
                        {
                            var n = f.FaceNormal;
                            var g = faces.OfType<PlanarFace>().FirstOrDefault(h => h != f && h.FaceNormal.IsAlmostEqualTo(n.Negate(), 1e-6));
                            if (g == null) continue;
                            if (!faces.OfType<PlanarFace>().Where(h => h != f && h != g).All(h => Math.Abs(h.FaceNormal.DotProduct(n)) < 1e-6)) continue;
                            if (f.Area > bestArea) { bestArea = f.Area; best = f; other = g; }
                        }
                        var item = new JsonObject { ["element_id"] = e.Id.Value, ["material"] = matName, ["volume_mm3"] = solid.Volume * Math.Pow(304.8, 3) };
                        var bb = solid.GetBoundingBox();
                        item["min"] = PointJson(bb.Transform.OfPoint(bb.Min)); item["max"] = PointJson(bb.Transform.OfPoint(bb.Max));
                        if (best == null) { item["prism"] = false; outSolids.Add(item); continue; }
                        // start cap: the one the extrusion leaves along +dir
                        var dir = other.FaceNormal;                       // from best towards other: other's outward normal
                        var len = Math.Abs((other.Origin - best.Origin).DotProduct(dir));
                        var loops = new JsonArray();
                        foreach (var loop in best.GetEdgesAsCurveLoops())
                        {
                            var pts = new JsonArray();
                            foreach (var c in loop)
                            {
                                var tess = c.Tessellate();
                                for (var i = 0; i < tess.Count - 1; i++) pts.Add(PointJson(tess[i]));
                            }
                            loops.Add(pts);
                        }
                        item["prism"] = true;
                        item["direction"] = new JsonObject { ["x"] = dir.X, ["y"] = dir.Y, ["z"] = dir.Z };
                        item["length_mm"] = len * 304.8;
                        item["loops"] = loops;                           // loops[0] outer (largest), others holes
                        outSolids.Add(item);
                    }
                }
                return new JsonObject { ["family"] = familyDoc.Title, ["count"] = outSolids.Count, ["solids"] = outSolids };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static JsonNode InspectFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            if (!target.Symbol.Family.IsEditable) throw new InvalidOperationException("This family cannot be edited.");
            // Read-only look inside the family; the copy is closed without saving.
            var familyDoc = doc.EditFamily(target.Symbol.Family);
            try
            {
                var items = new JsonArray();
                foreach (var e in new FilteredElementCollector(familyDoc).WhereElementIsNotElementType())
                {
                    var box = e.get_BoundingBox(null);
                    if (box == null || e is View || e is SketchPlane) continue;
                    var item = new JsonObject
                    {
                        ["id"] = e.Id.Value,
                        ["class"] = e.GetType().Name,
                        ["name"] = e.Name,
                        ["category"] = e.Category?.Name,
                        ["min"] = PointJson(box.Min),
                        ["max"] = PointJson(box.Max),
                    };
                    if (e is GenericForm)
                        item["material"] = familyDoc.GetElement(e.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM)?.AsElementId() ?? ElementId.InvalidElementId)?.Name;
                    if (e is FamilyInstance nested)
                    {
                        item["family"] = nested.Symbol.Family.Name;
                        item["type"] = nested.Symbol.Name;
                    }
                    items.Add(item);
                }
                return new JsonObject { ["family"] = familyDoc.Title, ["count"] = items.Count, ["items"] = items };
            }
            finally
            {
                familyDoc.Close(false);
            }
        }

        private static JsonNode InspectCut(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var target = RequireElement(doc, ReqId(p, "element_id")) as FamilyInstance
                         ?? throw new ArgumentException("element_id is not a family instance.");
            var family = target.Symbol.Family;
            var result = new JsonObject
            {
                ["can_be_cut_with_void"] = InstanceVoidCutUtils.CanBeCutWithVoid(target),
                ["family_allows_void_cut"] = family.get_Parameter(BuiltInParameter.FAMILY_ALLOW_CUT_WITH_VOIDS)?.AsInteger(),
                ["family_editable"] = family.IsEditable,
            };
            if (OptId(p, "cutter_id") is ElementId cutterId)
            {
                var allowed = SolidSolidCutUtils.CanElementCutElement(RequireElement(doc, cutterId), target, out var reason);
                result["solid_cut_allowed"] = allowed;
                result["solid_cut_reason"] = reason.ToString();
            }
            if (family.IsEditable)
            {
                // Read-only look inside the family; the copy is closed without saving.
                var familyDoc = doc.EditFamily(family);
                try
                {
                    var counts = new JsonObject();
                    foreach (var group in new FilteredElementCollector(familyDoc).WhereElementIsNotElementType()
                                 .Where(e => e is ImportInstance || e is GenericForm || e is FreeFormElement)
                                 .GroupBy(e => e.GetType().Name))
                        counts[group.Key] = group.Count();
                    result["family_contents"] = counts;
                }
                finally
                {
                    familyDoc.Close(false);
                }
            }
            return result;
        }

        private static JsonNode EnsureMaterial(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "name");
            var color = ColorOf(p, "color");
            return InTransaction(doc, $"Material {name}", () =>
            {
                var material = new FilteredElementCollector(doc).OfClass(typeof(Material)).Cast<Material>().FirstOrDefault(m => m.Name == name)
                               ?? (Material)doc.GetElement(Material.Create(doc, name));
                // RULE (user 12 Nov 2026): different materials, different colours. Unless exact_color is set, move the colour
                // to the nearest free colour: no other material in the model within RGB distance 24. Candidates round the
                // requested colour, cheapest first (distance, x3 off the grey axis so the hue is kept); a candidate outside
                // 0..255 is dropped, never clamped (clamping turned clashes white, 12 Nov 2026). No free colour: keep it.
                // Same search as client/materialColors.mjs nearestFree.
                var requested = color; var adjusted = false;
                if (color != null && !(p["exact_color"]?.GetValue<bool>() ?? false))
                {
                    var taken = new FilteredElementCollector(doc).OfClass(typeof(Material)).Cast<Material>()
                        .Where(m => m.Name != name && m.Color != null && m.Color.IsValid).Select(m => (r: (int)m.Color.Red, g: (int)m.Color.Green, b: (int)m.Color.Blue)).ToList();
                    bool Free(int r, int g, int b) => taken.All(t => Math.Sqrt((t.r - r) * (t.r - r) + (t.g - g) * (t.g - g) + (t.b - b) * (t.b - b)) >= 24);
                    int R0 = requested.Red, G0 = requested.Green, B0 = requested.Blue;
                    if (!Free(R0, G0, B0))
                    {
                        var cands = new List<(double cost, int r, int g, int b)>();
                        for (int dx = -1; dx <= 1; dx++) for (int dy = -1; dy <= 1; dy++) for (int dz = -1; dz <= 1; dz++)
                        {
                            if (dx == 0 && dy == 0 && dz == 0) continue;
                            double l = Math.Sqrt(dx * dx + dy * dy + dz * dz), off = 1 - Math.Abs(dx + dy + dz) / l / Math.Sqrt(3);
                            for (int rad = 6; rad <= 160; rad += 3)
                            {
                                int r = (int)Math.Round(R0 + dx / l * rad), g = (int)Math.Round(G0 + dy / l * rad), b = (int)Math.Round(B0 + dz / l * rad);
                                if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) continue;
                                cands.Add((rad * (1 + 2 * off), r, g, b));
                            }
                        }
                        foreach (var q in cands.OrderBy(q => q.cost))
                            if (Free(q.r, q.g, q.b)) { color = new Color((byte)q.r, (byte)q.g, (byte)q.b); adjusted = true; break; }
                    }
                }
                if (color != null) material.Color = color;
                material.Shininess = (int)(Num(p, "shininess") ?? material.Shininess);
                material.Smoothness = (int)(Num(p, "smoothness") ?? material.Smoothness);
                var o = new JsonObject { ["id"] = material.Id.Value, ["name"] = material.Name };
                if (color != null) o["color"] = new JsonObject { ["r"] = color.Red, ["g"] = color.Green, ["b"] = color.Blue };
                if (adjusted) o["color_adjusted"] = true;
                return o;
            });
        }

        /// <summary>Renames materials (and sets their colour) in the project AND inside every loaded family that uses them, then
        /// reloads those families, so schedules, tags and inspect_family all show the new name (approved colour codes, Makkah
        /// 6 Nov 2026). renames: [{from, to, color?}]; family_prefix limits which families are opened. When "to" already exists,
        /// the elements using "from" are moved to it (merge) and "from" stays unused.</summary>
        // Rename an instance family and/or its type (no prompt, one undo step).
        private static JsonNode RenameFamily(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var el = doc.GetElement(new ElementId(p["element_id"]!.GetValue<long>())) as FamilyInstance ?? throw new ArgumentException("element_id is not a family instance.");
            var fam = Str(p, "family_name"); var typ = Str(p, "type_name");
            using (var t = new Transaction(doc, "MCP: Rename family"))
            {
                t.Start();
                if (fam != null) el.Symbol.Family.Name = fam;
                if (typ != null) el.Symbol.Name = typ;
                t.Commit();
            }
            return new JsonObject { ["family"] = el.Symbol.Family.Name, ["type"] = el.Symbol.Name };
        }

        private static JsonNode RenameMaterials(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var items = (p["renames"] as JsonArray ?? throw new ArgumentException("renames is required.")).Select(n => n.AsObject())
                .Select(o => (from: ReqStr(o, "from"), to: ReqStr(o, "to"), color: o["color"] is JsonObject ? ColorOf(o, "color") : null)).ToList();
            var prefix = Str(p, "family_prefix");
            var report = new JsonArray();
            // 1. families first (their reload would otherwise bring the old names back into the project)
            var families = new FilteredElementCollector(doc).OfClass(typeof(Family)).Cast<Family>()
                .Where(f => f.IsEditable && !f.IsInPlace && (prefix == null || f.Name.StartsWith(prefix))).ToList();
            foreach (var family in families)
            {
                Document fdoc = null;
                try
                {
                    fdoc = doc.EditFamily(family);
                    var mats = new FilteredElementCollector(fdoc).OfClass(typeof(Material)).Cast<Material>().ToList();
                    if (!items.Any(it => mats.Any(m => m.Name == it.from))) continue;
                    var done = new JsonArray();
                    using (var t = new Transaction(fdoc, "MCP: Rename materials"))
                    {
                        t.Start();
                        foreach (var it in items)
                        {
                            var src = mats.FirstOrDefault(m => m.Name == it.from); if (src == null) continue;
                            var dst = mats.FirstOrDefault(m => m.Name == it.to);
                            if (dst == null) { src.Name = it.to; dst = src; }
                            else foreach (var form in new FilteredElementCollector(fdoc).OfClass(typeof(GenericForm)).Cast<GenericForm>())
                            {
                                var prm = form.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM);
                                if (prm != null && !prm.IsReadOnly && prm.AsElementId() == src.Id) prm.Set(dst.Id);
                            }
                            if (it.color != null) dst.Color = it.color;
                            done.Add(it.to);
                        }
                        t.Commit();
                    }
                    fdoc.LoadFamily(doc, new OverwriteFamily());
                    report.Add(new JsonObject { ["family"] = family.Name, ["materials"] = done });
                }
                catch (Exception e) { report.Add(new JsonObject { ["family"] = family.Name, ["error"] = e.Message }); }
                finally { fdoc?.Close(false); }
            }
            // 2. the project's own materials (merge when the new name exists already)
            var project = new JsonArray();
            InTransaction(doc, "Rename materials", () =>
            {
                var mats = new FilteredElementCollector(doc).OfClass(typeof(Material)).Cast<Material>().ToList();
                foreach (var it in items)
                {
                    var src = mats.FirstOrDefault(m => m.Name == it.from); var dst = mats.FirstOrDefault(m => m.Name == it.to);
                    if (src != null && dst == null) { src.Name = it.to; dst = src; project.Add($"{it.from} -> {it.to}"); }
                    else if (src != null) project.Add($"{it.from}: kept, {it.to} exists");
                    if (dst != null && it.color != null) dst.Color = it.color;
                }
                return null;
            });
            return new JsonObject { ["families"] = report, ["project"] = project };
        }

        /// <summary>Sets a material's cut pattern: solid, or a drafting hatch that is created when missing.</summary>
        private static JsonNode SetMaterialHatch(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var name = ReqStr(p, "material");
            var material = new FilteredElementCollector(doc).OfClass(typeof(Material)).Cast<Material>().FirstOrDefault(m => m.Name == name)
                           ?? throw new ArgumentException($"No material named '{name}'.");
            var solid = p["solid"]?.GetValue<bool>() ?? false;
            var cross = p["cross"]?.GetValue<bool>() ?? false;
            var angle = Num(p, "angle_degrees") ?? 45;
            var spacing = Num(p, "spacing_mm") ?? 1.5;
            // surface: true -> a MODEL pattern at real size on the material's faces (elevations, 3D), not the cut pattern.
            // rattan: true -> cane webbing weave, lines at 0/90/45/135 deg (user, 11 Nov 2026: "hatch to fit the rattan look").
            var surface = p["surface"]?.GetValue<bool>() ?? false;
            var rattan = p["rattan"]?.GetValue<bool>() ?? false;
            if (surface || rattan)
                return InTransaction(doc, $"Surface pattern {name}", () =>
                {
                    var sp = Num(p, "spacing_mm") ?? (rattan ? 12 : 10);
                    var pname = rattan ? $"Rattan Cane Weave {sp:0.##}" : $"Model {(cross ? "Cross " : "")}{angle:0.##} {sp:0.##}";
                    var pe = new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>()
                        .FirstOrDefault(f => f.Name == pname && f.GetFillPattern().Target == FillPatternTarget.Model);
                    if (pe == null)
                    {
                        var g = FromMm(sp);
                        var fp = new FillPattern(pname, FillPatternTarget.Model, FillPatternHostOrientation.ToHost);
                        var grids = new List<FillGrid>();
                        var angles = rattan ? new[] { 0.0, 90.0, 45.0, 135.0 } : cross ? new[] { angle, angle + 90 } : new[] { angle };
                        foreach (var a in angles)
                        {
                            var fg = new FillGrid { Angle = a * Math.PI / 180, Offset = (a % 90 == 0 ? g : g * Math.Sqrt(2)) };
                            grids.Add(fg);
                        }
                        fp.SetFillGrids(grids);
                        pe = FillPatternElement.Create(doc, fp);
                    }
                    material.SurfaceForegroundPatternId = pe.Id;
                    material.SurfaceForegroundPatternColor = p["color"] is JsonObject ? ColorOf(p, "color") : new Color(120, 85, 40);
                    if (p["shade"] is JsonObject) material.Color = ColorOf(p, "shade");
                    return new JsonObject { ["id"] = material.Id.Value, ["surface_pattern"] = pe.Name };
                });
            return InTransaction(doc, $"Hatch {name}", () =>
            {
                var patterns = new FilteredElementCollector(doc).OfClass(typeof(FillPatternElement)).Cast<FillPatternElement>().ToList();
                FillPatternElement pattern;
                if (solid) pattern = patterns.First(f => f.GetFillPattern().IsSolidFill);
                else
                {
                    var patternName = $"Hatch {(cross ? "Cross " : "")}{angle:0.##} {spacing:0.##}";
                    pattern = patterns.FirstOrDefault(f => f.Name == patternName && f.GetFillPattern().Target == FillPatternTarget.Drafting);
                    if (pattern == null)
                    {
                        var radians = angle * Math.PI / 180;
                        var gap = FromMm(spacing);
                        var fill = cross
                            ? new FillPattern(patternName, FillPatternTarget.Drafting, FillPatternHostOrientation.ToView, radians, gap, gap)
                            : new FillPattern(patternName, FillPatternTarget.Drafting, FillPatternHostOrientation.ToView, radians, gap);
                        pattern = FillPatternElement.Create(doc, fill);
                    }
                }
                material.CutForegroundPatternId = pattern.Id;
                // optional "color" {r,g,b}: a coloured hatch to tell materials apart on workshop sheets (user, 10 Nov 2026);
                // default mid grey (solid: black) per material-hatching.md
                material.CutForegroundPatternColor = p["color"] is JsonObject ? ColorOf(p, "color") : solid ? new Color(0, 0, 0) : new Color(128, 128, 128);
                return new JsonObject { ["id"] = material.Id.Value, ["pattern"] = pattern.Name };
            });
        }

        private static JsonNode CreatePipeRun(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var level = RequireLevel(doc, ReqId(p, "level_id"));
            var points = (p["points"] as JsonArray ?? throw new ArgumentException("points is required.")).Select(ToPoint).ToList();
            if (points.Count < 2) throw new ArgumentException("points needs at least 2 points.");
            var sysStr = ReqStr(p, "system");
            MEPSystemClassification classification;
            string createName = null;
            if (sysStr.Equals("FireProtection", StringComparison.OrdinalIgnoreCase)) { classification = MEPSystemClassification.FireProtectWet; createName = "Fire Protection"; }
            else if (sysStr.Equals("ChilledWater", StringComparison.OrdinalIgnoreCase)) { classification = MEPSystemClassification.SupplyHydronic; createName = "Chilled Water"; }
            else if (!Enum.TryParse<MEPSystemClassification>(sysStr, true, out classification))
                throw new ArgumentException("system must be DomesticColdWater, DomesticHotWater, Sanitary, FireProtection or ChilledWater.");
            var system = new FilteredElementCollector(doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.PipingSystemType)).Cast<Autodesk.Revit.DB.Plumbing.PipingSystemType>()
                             .FirstOrDefault(s => createName != null ? s.Name.Equals(createName, StringComparison.OrdinalIgnoreCase) : s.SystemClassification == classification);
            if (system == null)
                InTransaction(doc, "Create piping system type", () =>
                {
                    system = Autodesk.Revit.DB.Plumbing.PipingSystemType.Create(doc, classification, createName ?? classification.ToString());
                    return new JsonObject { ["created"] = system.Name };
                });
            var pipeType = new FilteredElementCollector(doc).OfClass(typeof(Autodesk.Revit.DB.Plumbing.PipeType)).FirstElementId();
            if (pipeType == ElementId.InvalidElementId) throw new InvalidOperationException("This model has no pipe type.");
            var diameter = FromMm(ReqNum(p, "diameter_mm"));
            var comments = Str(p, "comments");

            return InTransaction(doc, "Create pipe run", () =>
            {
                var pipes = new List<Autodesk.Revit.DB.Plumbing.Pipe>();
                for (var i = 0; i + 1 < points.Count; i++)
                {
                    var pipe = Autodesk.Revit.DB.Plumbing.Pipe.Create(doc, system.Id, pipeType, level.Id, points[i], points[i + 1]);
                    pipe.get_Parameter(BuiltInParameter.RBS_PIPE_DIAMETER_PARAM).Set(diameter);
                    if (comments != null) pipe.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);
                    pipes.Add(pipe);
                }
                doc.Regenerate();
                var elbows = 0;
                var missing = 0;
                for (var i = 0; i + 1 < pipes.Count; i++)
                {
                    var a = pipes[i].ConnectorManager.Connectors.Cast<Connector>().OrderBy(c => c.Origin.DistanceTo(points[i + 1])).First();
                    var b = pipes[i + 1].ConnectorManager.Connectors.Cast<Connector>().OrderBy(c => c.Origin.DistanceTo(points[i + 1])).First();
                    try
                    {
                        doc.Create.NewElbowFitting(a, b);
                        elbows++;
                    }
                    catch (Autodesk.Revit.Exceptions.ApplicationException)
                    {
                        missing++;
                    }
                }
                return new JsonObject
                {
                    ["ids"] = new JsonArray(pipes.Select(x => (JsonNode)x.Id.Value).ToArray()),
                    ["elbows"] = elbows,
                    ["elbows_missing"] = missing,
                };
            });
        }

        private static JsonNode CreatePanelSchedule(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var panel = RequireElement(doc, ReqId(p, "panel_id")) as FamilyInstance
                        ?? throw new ArgumentException("panel_id is not a family instance.");
            return InTransaction(doc, "Create panel schedule", () =>
            {
                var view = Autodesk.Revit.DB.Electrical.PanelScheduleView.CreateInstanceView(doc, panel.Id);
                return new JsonObject { ["id"] = view.Id.Value, ["name"] = view.Name };
            });
        }

        private static JsonNode CreateCircuit(UIApplication app, JsonObject p)
        {
            var doc = Doc(app);
            var deviceIds = ReqIds(p, "device_ids");
            foreach (var id in deviceIds) RequireElement(doc, id);
            var panel = OptId(p, "panel_id") is ElementId panelId ? RequireElement(doc, panelId) as FamilyInstance
                        ?? throw new ArgumentException("panel_id is not a family instance.") : null;
            var name = Str(p, "name");

            return InTransaction(doc, "Create circuit", () =>
            {
                var circuit = Autodesk.Revit.DB.Electrical.ElectricalSystem.Create(
                    doc, deviceIds, Autodesk.Revit.DB.Electrical.ElectricalSystemType.PowerCircuit);
                if (panel != null) circuit.SelectPanel(panel);
                if (name != null) circuit.get_Parameter(BuiltInParameter.RBS_ELEC_CIRCUIT_NAME)?.Set(name);
                return new JsonObject
                {
                    ["id"] = circuit.Id.Value,
                    ["circuit_number"] = circuit.CircuitNumber,
                    ["panel"] = circuit.PanelName,
                    ["devices"] = deviceIds.Count,
                };
            });
        }

        /// <summary>View-specific elements must lie in the view's plane, so drop any offset along the view direction.</summary>
        private static XYZ OnViewPlane(View view, XYZ point)
        {
            var normal = view.ViewDirection;
            return point - normal * (point - view.Origin).DotProduct(normal);
        }

        // ---- Transactions --------------------------------------------------------------------------

        /// <summary>Runs one undoable step. Warnings are returned rather than shown, since a dialog would block the bridge.</summary>
        private static JsonNode InTransaction(Document doc, string name, Func<JsonObject> body)
        {
            if (doc.IsReadOnly) throw new InvalidOperationException("The document is read-only.");

            using (var transaction = new Transaction(doc, $"MCP: {name}"))
            {
                var failures = new FailureCollector();
                var options = transaction.GetFailureHandlingOptions();
                options.SetFailuresPreprocessor(failures);
                options.SetClearAfterRollback(true);
                transaction.SetFailureHandlingOptions(options);

                transaction.Start();
                JsonObject result;
                try
                {
                    result = body();
                }
                catch
                {
                    transaction.RollBack();
                    throw;
                }

                if (transaction.Commit() != TransactionStatus.Committed)
                    throw new InvalidOperationException($"Revit rolled back the change: {string.Join("; ", failures.Errors)}");

                if (failures.Warnings.Count > 0)
                    result["warnings"] = new JsonArray(failures.Warnings.Select(w => (JsonNode)w).ToArray());
                return result;
            }
        }

        private sealed class FailureCollector : IFailuresPreprocessor
        {
            public readonly List<string> Warnings = new List<string>();
            public readonly List<string> Errors = new List<string>();
            private static readonly string[] FatalWarnings = { "must be attached" };

            public FailureProcessingResult PreprocessFailures(FailuresAccessor accessor)
            {
                var hasError = false;
                foreach (var message in accessor.GetFailureMessages())
                {
                    // Warnings that mean an MEP joint is not real are treated as errors, so the change rolls back.
                    if (message.GetSeverity() == FailureSeverity.Warning && FatalWarnings.Any(f => message.GetDescriptionText().IndexOf(f, StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        Errors.Add(message.GetDescriptionText());
                        hasError = true;
                    }
                    else if (message.GetSeverity() == FailureSeverity.Warning)
                    {
                        Warnings.Add(message.GetDescriptionText());
                        accessor.DeleteWarning(message);
                    }
                    else
                    {
                        Errors.Add(message.GetDescriptionText());
                        hasError = true;
                    }
                }
                return hasError ? FailureProcessingResult.ProceedWithRollBack : FailureProcessingResult.Continue;
            }
        }

        // ---- Serialisation -------------------------------------------------------------------------

        private static JsonObject Summary(Document doc, Element e)
        {
            var type = doc.GetElement(e.GetTypeId()) as ElementType;
            var result = new JsonObject
            {
                ["id"] = e.Id.Value,
                ["name"] = e.Name,
                ["category"] = e.Category?.Name,
                ["family"] = type?.FamilyName,
                ["type"] = type?.Name,
                ["level"] = (doc.GetElement(LevelIdOf(e)) as Level)?.Name,
            };
            var location = LocationJson(e);
            if (location != null) result["location"] = location;
            return result;
        }

        private static JsonObject LocationJson(Element e)
        {
            try
            {
                switch (e.Location)
                {
                    case LocationPoint point:
                        var json = new JsonObject { ["point"] = PointJson(point.Point) };
                        try
                        {
                            json["rotation_deg"] = Math.Round(point.Rotation * 180 / Math.PI, 3);
                        }
                        catch (Autodesk.Revit.Exceptions.InvalidOperationException)
                        {
                            // Some point-located elements have no rotation.
                        }
                        return json;
                    case LocationCurve curve:
                        return new JsonObject
                        {
                            ["start"] = PointJson(curve.Curve.GetEndPoint(0)),
                            ["end"] = PointJson(curve.Curve.GetEndPoint(1)),
                            ["length_mm"] = ToMm(curve.Curve.Length),
                        };
                }
            }
            catch (Autodesk.Revit.Exceptions.ApplicationException)
            {
                // Location is optional detail; unbound curves and similar must not fail the whole query.
            }
            return null;
        }

        private static JsonArray ParametersOf(Document doc, Element e)
        {
            var parameters = e.Parameters.Cast<Parameter>()
                .OrderBy(x => x.Definition.Name)
                .Select(x => (JsonNode)new JsonObject
                {
                    ["name"] = x.Definition.Name,
                    ["value"] = DisplayValue(doc, x),
                    ["storage"] = x.StorageType.ToString(),
                    ["read_only"] = x.IsReadOnly,
                });
            return new JsonArray(parameters.ToArray());
        }

        private static string DisplayValue(Document doc, Parameter parameter)
        {
            if (!parameter.HasValue) return null;
            switch (parameter.StorageType)
            {
                case StorageType.String:
                    return parameter.AsString();
                case StorageType.ElementId:
                    var id = parameter.AsElementId();
                    return doc.GetElement(id)?.Name ?? (id == ElementId.InvalidElementId ? null : id.Value.ToString());
                case StorageType.Integer:
                    return parameter.AsValueString() ?? parameter.AsInteger().ToString();
                case StorageType.Double:
                    return parameter.AsValueString() ?? parameter.AsDouble().ToString(System.Globalization.CultureInfo.InvariantCulture);
                default:
                    return null;
            }
        }

        private static JsonObject Page<T>(IEnumerable<T> items, JsonObject p, string key, Func<T, JsonObject> project)
        {
            var offset = (int)(Num(p, "offset") ?? 0);
            var limit = Limit(p);
            var total = 0;
            var page = new JsonArray();
            foreach (var item in items)
            {
                if (total >= offset && page.Count < limit) page.Add(project(item));
                total++;
            }
            return new JsonObject
            {
                ["total"] = total,
                ["offset"] = offset,
                ["returned"] = page.Count,
                [key] = page,
            };
        }

        private static JsonObject PointJson(XYZ point) => new JsonObject
        {
            ["x"] = ToMm(point.X),
            ["y"] = ToMm(point.Y),
            ["z"] = ToMm(point.Z),
        };

        private static JsonObject DirectionJson(XYZ direction) => new JsonObject
        {
            ["x"] = Math.Round(direction.X, 6),
            ["y"] = Math.Round(direction.Y, 6),
            ["z"] = Math.Round(direction.Z, 6),
        };

        private static double ToMm(double feet) => Math.Round(feet * MmPerFoot, 3);
        private static double FromMm(double mm) => mm / MmPerFoot;

        // ---- Lookups -------------------------------------------------------------------------------

        private static Document Doc(UIApplication app)
        {
            if (!string.IsNullOrEmpty(_target))
            {
                foreach (Document d in app.Application.Documents)
                    if (!d.IsLinked && (string.Equals(d.Title, _target, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(d.PathName, _target, StringComparison.OrdinalIgnoreCase))) return d;
                // A linked model can be named too, for reading (levels, element extents): Revit makes linked documents
                // read-only, so a write to one fails on its own.
                foreach (Document d in app.Application.Documents)
                    if (d.IsLinked && (string.Equals(d.Title, _target, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(d.PathName, _target, StringComparison.OrdinalIgnoreCase))) return d;
                throw new InvalidOperationException($"Document '{_target}' is not open in this Revit.");
            }
            return app.ActiveUIDocument?.Document
                   ?? throw new InvalidOperationException("No document is open in Revit.");
        }

        private static Element RequireElement(Document doc, ElementId id)
        {
            return doc.GetElement(id) ?? throw new ArgumentException($"No element with id {id.Value}.");
        }

        private static Level RequireLevel(Document doc, ElementId id)
        {
            return RequireElement(doc, id) as Level ?? throw new ArgumentException($"Element {id.Value} is not a level.");
        }

        /// <summary>Accepts a BuiltInCategory name (OST_Walls) or a display name (Walls).</summary>
        private static Category ResolveCategory(Document doc, string name)
        {
            if (Enum.TryParse<BuiltInCategory>(name, true, out var builtIn) && name.StartsWith("OST_", StringComparison.OrdinalIgnoreCase))
            {
                return Category.GetCategory(doc, builtIn) ?? throw new ArgumentException($"Category '{name}' is not in this model.");
            }
            return doc.Settings.Categories.Cast<Category>()
                       .FirstOrDefault(c => c.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                   ?? throw new ArgumentException($"Unknown category '{name}'.");
        }

        private static ElementId LevelIdOf(Element e)
        {
            if (e.LevelId != ElementId.InvalidElementId) return e.LevelId;

            // Many hosted and face-based instances report their level only through a parameter.
            return e.get_Parameter(BuiltInParameter.FAMILY_LEVEL_PARAM)?.AsElementId()
                   ?? e.get_Parameter(BuiltInParameter.INSTANCE_REFERENCE_LEVEL_PARAM)?.AsElementId()
                   ?? ElementId.InvalidElementId;
        }

        private static bool OnLevel(Element e, ElementId levelId) => LevelIdOf(e) == levelId;

        private static bool Contains(string text, string search) =>
            text != null && text.IndexOf(search, StringComparison.OrdinalIgnoreCase) >= 0;

        // ---- Parameter parsing ---------------------------------------------------------------------

        private static string Str(JsonObject p, string key) => p[key]?.GetValue<string>();

        private static string ReqStr(JsonObject p, string key) =>
            Str(p, key) ?? throw new ArgumentException($"{key} is required.");

        private static double? Num(JsonObject p, string key) => p[key]?.GetValue<double>();

        private static double ReqNum(JsonObject p, string key) =>
            Num(p, key) ?? throw new ArgumentException($"{key} is required.");

        private static bool Bool(JsonObject p, string key) => p[key]?.GetValue<bool>() ?? false;

        private static int Limit(JsonObject p) => Math.Min((int)(Num(p, "limit") ?? DefaultLimit), MaxLimit);

        private static ElementId OptId(JsonObject p, string key) =>
            p[key] == null ? null : new ElementId(p[key].GetValue<long>());

        private static ElementId ReqId(JsonObject p, string key) =>
            OptId(p, key) ?? throw new ArgumentException($"{key} is required.");

        private static List<ElementId> ReqIds(JsonObject p, string key)
        {
            var array = p[key] as JsonArray ?? throw new ArgumentException($"{key} is required.");
            return array.Select(n => new ElementId(n.GetValue<long>())).ToList();
        }

        private static XYZ ReqPoint(JsonObject p, string key) =>
            ToPoint(p[key] ?? throw new ArgumentException($"{key} is required."));

        private static XYZ ToPoint(JsonNode node)
        {
            var o = node.AsObject();
            return new XYZ(FromMm(ReqNum(o, "x")), FromMm(ReqNum(o, "y")), FromMm(Num(o, "z") ?? 0));
        }
    }
}
