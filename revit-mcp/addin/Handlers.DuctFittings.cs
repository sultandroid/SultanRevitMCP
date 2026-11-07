using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Mechanical;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        /// <summary>
        /// connect_ducts: joins two straight native ducts with Revit's own routing-preference fitting.
        ///   document (exact full path), duct_a, duct_b, mode:
        ///   "elbow"      - the two centrelines cross in plan at an angle; the nearer end of each is moved to the crossing
        ///                  point and an elbow is placed. Both centrelines must be at the same height (max_dz_mm, default 5).
        ///   "transition" - the ducts are in line (axes parallel, offset below max_offset_mm, default 30); the gap between the
        ///                  facing ends is closed by a transition (reducer). Vertical offset is allowed if the family supports it.
        ///   "tap"        - duct_a is a branch whose nearer end is moved to the side of duct_b (the main) and joined with a
        ///                  takeoff. Branch and main centrelines must be at heights the takeoff can take.
        /// Ends that move are reported with before/after lengths. Any failure rolls back the whole change.
        /// </summary>
        private static JsonNode ConnectDucts(UIApplication app, JsonObject p)
        {
            var doc = RequireNativePilotDocument(app, p);
            var a = RequireElement(doc, ReqId(p, "duct_a")) as Duct ?? throw new ArgumentException("duct_a is not a duct.");
            var b = RequireElement(doc, ReqId(p, "duct_b")) as Duct ?? throw new ArgumentException("duct_b is not a duct.");
            var mode = (Str(p, "mode") ?? "elbow").ToLowerInvariant();
            var maxDz = FromMm(Num(p, "max_dz_mm") ?? 5);
            var maxOff = FromMm(Num(p, "max_offset_mm") ?? 30);
            var la = (a.Location as LocationCurve)?.Curve as Line ?? throw new ArgumentException("duct_a is not straight.");
            var lb = (b.Location as LocationCurve)?.Curve as Line ?? throw new ArgumentException("duct_b is not straight.");
            var report = new JsonObject { ["mode"] = mode, ["duct_a"] = a.Id.Value, ["duct_b"] = b.Id.Value,
                ["a_length_before_mm"] = ToMm(la.Length), ["b_length_before_mm"] = ToMm(lb.Length) };

            return InTransaction(doc, "Connect ducts (" + mode + ")", () =>
            {
                FamilyInstance fitting;
                if (mode == "elbow")
                {
                    if (Math.Abs(la.GetEndPoint(0).Z - lb.GetEndPoint(0).Z) > maxDz) throw new ArgumentException("Elbow needs both centrelines at the same height.");
                    var x = PlanCrossing(la, lb) ?? throw new ArgumentException("The ducts are parallel; use transition.");
                    var ea = MoveNearEnd(a, la, x);
                    var eb = MoveNearEnd(b, lb, x);
                    doc.Regenerate();
                    fitting = doc.Create.NewElbowFitting(EndConnector(a, x), EndConnector(b, x));
                    report["moved_a_mm"] = ea; report["moved_b_mm"] = eb;
                }
                else if (mode == "transition")
                {
                    var da = la.Direction; var db = lb.Direction;
                    if (Math.Abs(Math.Abs(da.DotProduct(db)) - 1) > 1e-4) throw new ArgumentException("Transition needs parallel ducts.");
                    // facing ends: the pair of end points that are closest
                    XYZ pa = null, pb = null; double best = double.MaxValue;
                    foreach (var i in new[] { 0, 1 }) foreach (var j in new[] { 0, 1 })
                    {
                        var d = la.GetEndPoint(i).DistanceTo(lb.GetEndPoint(j));
                        if (d < best) { best = d; pa = la.GetEndPoint(i); pb = lb.GetEndPoint(j); }
                    }
                    var gap = pb - pa;
                    var lateral = gap - da.Multiply(gap.DotProduct(da));
                    var lateralPlan = new XYZ(lateral.X, lateral.Y, 0).GetLength();
                    if (lateralPlan > maxOff) throw new ArgumentException($"Ducts are not in line: plan offset {ToMm(lateralPlan)} mm.");
                    doc.Regenerate();
                    fitting = doc.Create.NewTransitionFitting(EndConnector(a, pa), EndConnector(b, pb));
                    report["gap_mm"] = ToMm(best); report["plan_offset_mm"] = ToMm(lateralPlan);
                }
                else if (mode == "tap")
                {
                    var x = PlanCrossing(la, lb) ?? throw new ArgumentException("Branch and main are parallel.");
                    // the takeoff must land on the main: the crossing has to fall inside the main's length, clear of its ends
                    var bStart = lb.GetEndPoint(0); var along = new XYZ(x.X - bStart.X, x.Y - bStart.Y, 0).DotProduct(new XYZ(lb.Direction.X, lb.Direction.Y, 0).Normalize());
                    var flatLen = new XYZ(lb.Direction.X, lb.Direction.Y, 0).GetLength() * lb.Length;
                    var branchHalf = (a.get_Parameter(BuiltInParameter.RBS_CURVE_WIDTH_PARAM)?.AsDouble() ?? 0) / 2;
                    if (along < branchHalf || along > flatLen - branchHalf)
                        throw new ArgumentException($"The branch meets the main's line {ToMm(along)} mm along a {ToMm(flatLen)} mm main: outside the main, so a takeoff cannot attach. Extend the main or use another joint.");
                    // stop the branch at the main's side face: back off half the main's width along the branch
                    var halfW = (b.get_Parameter(BuiltInParameter.RBS_CURVE_WIDTH_PARAM)?.AsDouble() ?? 0) / 2;
                    var near = la.GetEndPoint(0).DistanceTo(x) < la.GetEndPoint(1).DistanceTo(x) ? la.GetEndPoint(0) : la.GetEndPoint(1);
                    var towards = (new XYZ(x.X, x.Y, near.Z) - near);
                    var dir = towards.GetLength() > 1e-9 ? towards.Normalize() : la.Direction;
                    var cos = Math.Abs(dir.DotProduct(new XYZ(-lb.Direction.Y, lb.Direction.X, 0).Normalize()));
                    var face = new XYZ(x.X, x.Y, near.Z) - dir.Multiply(cos > 1e-6 ? halfW / cos : halfW);
                    report["moved_a_mm"] = MoveNearEnd(a, la, face);
                    doc.Regenerate();
                    fitting = doc.Create.NewTakeoffFitting(EndConnector(a, face), b);
                }
                else throw new ArgumentException("mode must be elbow, transition or tap.");
                doc.Regenerate();
                // Revit can place a fitting that is not really joined (e.g. "The Tap must be attached to duct"): refuse it.
                var loose = fitting.MEPModel?.ConnectorManager?.Connectors.Cast<Connector>().Count(c => !c.IsConnected) ?? 0;
                if (loose > 0)
                    throw new InvalidOperationException($"The {mode} fitting was placed with {loose} unconnected end(s), so the joint is not real (for a tap: the branch must be smaller than the main's side face). Rolled back.");
                report["fitting_id"] = fitting.Id.Value;
                report["fitting_family"] = fitting.Symbol?.FamilyName;
                report["fitting_type"] = fitting.Symbol?.Name;
                report["a_length_after_mm"] = ToMm(((a.Location as LocationCurve).Curve).Length);
                report["b_length_after_mm"] = ToMm(((b.Location as LocationCurve).Curve).Length);
                return report;
            });
        }

        /// <summary>Plan intersection of two lines (as infinite lines), at the height of the first; null when parallel.</summary>
        private static XYZ PlanCrossing(Line la, Line lb)
        {
            XYZ p = la.GetEndPoint(0), r = la.Direction, q = lb.GetEndPoint(0), s = lb.Direction;
            var den = r.X * s.Y - r.Y * s.X;
            if (Math.Abs(den) < 1e-6) return null;
            var t = ((q.X - p.X) * s.Y - (q.Y - p.Y) * s.X) / den;
            return new XYZ(p.X + t * r.X, p.Y + t * r.Y, p.Z + t * r.Z);
        }

        /// <summary>Moves the end of the duct nearer to target onto target (same height as that end); returns the distance moved in mm.</summary>
        private static double MoveNearEnd(Duct duct, Line line, XYZ target)
        {
            var e0 = line.GetEndPoint(0); var e1 = line.GetEndPoint(1);
            var t = new XYZ(target.X, target.Y, (e0.DistanceTo(target) < e1.DistanceTo(target) ? e0 : e1).Z);
            Line nl = e0.DistanceTo(t) < e1.DistanceTo(t) ? Line.CreateBound(t, e1) : Line.CreateBound(e0, t);
            var moved = Math.Min(e0.DistanceTo(t), e1.DistanceTo(t));
            ((LocationCurve)duct.Location).Curve = nl;
            return ToMm(moved);
        }

        private static Connector EndConnector(Duct duct, XYZ near) =>
            duct.ConnectorManager.Connectors.Cast<Connector>().Where(c => c.ConnectorType == ConnectorType.End && !c.IsConnected)
                .OrderBy(c => c.Origin.DistanceTo(near)).FirstOrDefault()
            ?? throw new InvalidOperationException($"Duct {duct.Id.Value} has no free end near the joint.");
    }
}
