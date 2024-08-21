'''
Decision tree to evaluate the FoXS fit of the BilboMD results and give a prediction of what went wrong with the experiment
Ex: not enough flexibility, wrong oligomerization, etc.

Inputs BilboMD results folder into command line 

Ex: ../pipeline_decision_tree.py results
'''

import bioxtasraw.RAWAPI as raw
import copy
import glob
import sys
import os
import os.path
import shutil
import json

print_flag = True

def print_debug(arg):
    '''
    print statement with flag for debugging
    '''
    if print_flag:
        print(arg)


#Define RAW functions

def load_file(path):
    '''
    Loads profiles using raw.load_profiles()

    If file does not have a header which labels the q, experiment, model and error columns, raw.load_profiles() does not interpret it properly
    
    If no header, it will add the following header to the first line of the multi_state_model file if it doesn't already have it

    q       exp_intensity   model_intensity error

    

    TBA: compatibility for FoXS files which use the format:

    q       exp_intensity   error model_intensity
    '''

    header_multifoxs = '#  q       exp_intensity   model_intensity error' 
    with open(path) as file:
        if header_multifoxs in file.read():
            SASM = raw.load_profiles(path)
        else:
            if os.path.isdir('temp') == False:
                os.makedirs('temp')
            shutil.copy(path, 'temp')
            new_path =  'temp/' + os.path.basename(path)
            with open(new_path, 'r+') as new_file:
                new_file_data = new_file.read()
                new_file.seek(0,0)
                new_file.write(header_multifoxs + '\n' + new_file_data)
            SASM = raw.load_profiles(new_path)
            shutil.rmtree('temp')
    return SASM

def rg_auto(prof):
    '''
    Returns Rg calculated from a RAW SASM
    '''
    rg = raw.auto_guinier(prof)[0]
    return rg

def mw_bayes(prof):
    '''
    Returns the Bayesian MW of a RAW SASM

    Needs to run raw.auto_guinier() first to fill guinier_dict with the correct guinier results for MW calc
    '''
    raw.auto_guinier(prof)
    mw = raw.mw_bayes(prof)[0]
    return mw

def q_region(prof, qLB, qUB):
    '''
    Trims a RAW SASM to qLB < q < qUB
    '''
    region = copy.deepcopy(prof)
    region.setQrange([region.closest(region.getQ(), qLB), region.closest(region.getQ(), qUB)])
    return region

def chi_square(prof1, prof2):
    '''
    Returns the chi-square between two RAW SASM
    '''
    return (1 / len(prof1.getQ())) * sum(pow(((prof1.getI() - prof2.getI())/prof1.getErr()), 2))

def chi_square_region(prof1, prof2, qLB, qUB):
    '''
    Returns the chi-square between two RAW SASM within qLB < q < qUB

    Combination of chi_square() and q_region() functions
    '''
    return chi_square(q_region(prof1, qLB, qUB), q_region(prof2, qLB, qUB))

def residual(prof1, prof2):
    '''
    Returns the residuals(q) between two RAW SASM
    '''
    return (prof1.getI() - prof2.getI())/prof1.getErr()

def mean(list):
    '''
    Returns the mean value of the the elements of a list

    idk why this isn't already a function in basic python
    '''
    return sum(list) / len(list)

def residuals_region(prof1, prof2):
    '''
    Returns the mean of the residual of all data points between two RAW SASM
    '''
    return mean(residual(prof1, prof2))



Bilbo_output_folder = sys.argv[1]

multi_state_models = sorted(glob.glob(Bilbo_output_folder + "/multi_state_model_*", recursive=True))
cs_models = []
for m in multi_state_models:
    prof = load_file(m)
    m_cs = chi_square(prof[0], prof[1])
    cs_models.append(m_cs)

def best_chi_square_i():
    '''
    Selects the "best" chi-square from all multi state files in the input folder

    Returns the index of the best chi-square in cs_models

    Goes through the list and selects the first chi-square that is high error (< 20%) with the previous value
    '''
    print_debug("\nComparing chi-squares of all multistates")
    cs_models_rounded = [round(cs, 2) for cs in cs_models]
    print_debug(cs_models_rounded)
    csm_err_threshold = 0.2
    i = 0
    if len(cs_models) == 1:
        best_cs = cs_models[0]
    else:
        while i < (len(cs_models)-1):
            csm_err = abs(cs_models[i+1]-cs_models[i])/cs_models[i]
            if csm_err <= csm_err_threshold:
                best_cs = cs_models[i]
                break
            elif i == (len(cs_models)-2):
                best_cs = min(cs_models)
                break
            else:
                i=i+1
    multi_states_file = multi_state_models[cs_models.index(best_cs)]
    multi_states_num_i = multi_states_file.find("multi_state_model_")
    multi_states_num = multi_states_file[multi_states_num_i + 18]
    print_debug("\nThe best chi-square is " + str(round(best_cs, 2))+ " (" + multi_states_num + " multi states)")
    return cs_models.index(best_cs)

profs = load_file(multi_state_models[best_chi_square_i()])

eprof = profs[0]
mprof = profs[1]

e_mw = mw_bayes(eprof)
m_mw = mw_bayes(mprof)

mw_err = abs((e_mw - m_mw) / e_mw)
mw_err_cutoff = 0.10

def check_mw():
    '''
    Compares the % error between the MW calculated from the experimental and model profiles

    returns "low_error" if the error is < 5% (defined by mw_cutoff)
    returns "high_error" otherwise
    '''
    print_debug("Experimental MW = " + str(e_mw) + ", Model MW = " + str(m_mw))
    if mw_err < mw_err_cutoff:
        return "low_error"
    else:
        return "high_error"


overall_chi_square = chi_square(eprof, mprof)

def check_overall():
   '''
   Judges the quality of the overall chi-square between the experimental and model profiles

   returns "excellent_cs" if chi-square < 2

   returns "moderate_cs" if 2 < chi-square < 4

   returns "bad_cs" if chi-square > 4
   '''
   if overall_chi_square < 2:
       print_debug("Overall chi-square = "+ str(round(overall_chi_square,2)) + ", Excellent fit")
       return "excellent_cs"
   elif overall_chi_square < 4:
       print_debug("Overall chi-square = "+ str(round(overall_chi_square,2)) + ", Moderate fit")
       return "moderate_cs"
   else:
       print_debug("Overall chi-square = "+ str(round(overall_chi_square,2)) + ", Bad fit")
       return "bad_cs"
   


q_min = eprof.getQ()[0]
q_max = eprof.getQ()[-1]
q_ranges = [q_min, 0.1, 0.2, q_max]
q_rangesi = list(range(0,len(q_ranges)-1))

def chi_squares():
    '''
    returns list of chi-square values for each q-region, which has bounds defined in q_ranges
    '''
    chi_squares_of_regions = []
    for r in q_rangesi:
        eregion = q_region(eprof, q_ranges[r], q_ranges[r+1])
        mregion = q_region(mprof, q_ranges[r], q_ranges[r+1])
        n = chi_square(eregion, mregion)
        chi_squares_of_regions.append(n)
        print_debug("Chi-square of " + str(round(q_ranges[r],2)) + " < q < " + str(round(q_ranges[r+1],2)) + ": " + str(round(n,2)))
    return chi_squares_of_regions

print_debug("")
chi_squares_of_regions = chi_squares()



def residuals():
    '''
    returns list of mean residuals for each q-region, which has bounds defined in q_ranges
    '''
    residuals_of_regions = []
    for r in q_rangesi:
        eregion = q_region(eprof, q_ranges[r], q_ranges[r+1])
        mregion = q_region(mprof, q_ranges[r], q_ranges[r+1])
        n = residuals_region(eregion, mregion)
        residuals_of_regions.append(n)
        print_debug("Mean residuals of " + str(round(q_ranges[r],2)) + " < q < " + str(round(q_ranges[r+1],2)) + ": " + str(round(n,2)))
    return residuals_of_regions

print_debug("")
residuals_of_regions =  residuals()



def highest_cs():
   '''
   Determines the q-region with the highest chi-square value

   returns "low_q_err" if the highest is chi_squares_of_regions[0]
   returns "mid_q_err" if the highest is chi_squares_of_regions[1]
   returns "high_q_err" if the highest is chi_squares_of_regions[2]

   need to figure out how to make this more general if we want to change the number of regions from 3
   '''
   highest_cs = max(chi_squares_of_regions)
   i = chi_squares_of_regions.index(highest_cs)
   qLB = q_ranges[i]
   qUB = q_ranges[i+1]
   if highest_cs > 2:
        highest_chi_square_report = "The chi-square is highest ("+ str(round(highest_cs,2))+") in the region where (" +  str(round(qLB,2)) + " < q < " + str(round(qUB,2)) + ")"
        print_debug(highest_chi_square_report)
        if i == 0:
            return "low_q_err", highest_chi_square_report
        elif i == 1:
            return "mid_q_err", highest_chi_square_report
        elif i == 2:
            return "high_q_err", highest_chi_square_report
   else: 
      highest_chi_square_report = "The chi-square is highest ("+ round(highest_cs,2)+") in the region where " +  round(qLB,2) + " < q < " + round(qU,2) + ", but this is okay."
      print_debug(highest_chi_square_report)
      return "no_q_err", highest_chi_square_report 

def second_highest_cs():
   '''
   Determines if q-region with the second highest chi-square value is > 2

   returns "low_q_err" if the 2nd highest is chi_squares_of_regions[0]
   returns "mid_q_err" if the 2nd highest is chi_squares_of_regions[1]
   returns "high_q_err" if the 2nd highest is chi_squares_of_regions[2]

   need to figure out how to make this more general if we want to change the number of regions from 3
   '''
   chisquare_all_regions_sorted = copy.deepcopy(chi_squares_of_regions)
   chisquare_all_regions_sorted.sort()
   second_highest_cs = chisquare_all_regions_sorted[-2]
   i = chi_squares_of_regions.index(second_highest_cs)
   qLB = q_ranges[i]
   qUB = q_ranges[i+1]
   if second_highest_cs > 2:
        second_highest_cs_report = "The chi-square is also high ("+ str(round(second_highest_cs))+") is in the region where " +  str(round(qLB,2)) + " < q < " + str(round(qUB,2)) + "."
        print_debug(second_highest_cs_report)
        if i == 0:
            return "low_q_err", second_highest_cs_report
        elif i == 1:
            return "mid_q_err", second_highest_cs_report
        elif i == 2:
            return "high_q_err", second_highest_cs_report
   else:
       second_highest_cs_report = "The 2nd highest chi-square ("+ str(round(second_highest_cs,2))+") is in the region where " +  str(round(qLB,2)) + " < q < " + str(round(qUB,2)) + ", but this is okay."
       print_debug(second_highest_cs_report)
       return "no_q_err", second_highest_cs_report



def region_check():
    if all(cs < 2 for cs in chi_squares_of_regions):
        return "all_good"
    else:
        return



def high_q_noise():
    '''
    returns "high_noise" if  the chi-square of the highest most q-region is < 0.5

    If the fit is good, but chi-square is < 0.5 in high-q, this suggests high noise in the sample
    '''
    if chi_squares_of_regions[-1] < 0.5:
        return "high_noise"



def start_tree():
    '''
    Starts the decision tree. Outputs user feedback based on the goodness of fit to the model.
    '''
    print_debug("")
    mw_flag = check_mw()
    overall_cs_flag = check_overall()
    highest_cs_flag, highest_chi_square_report = highest_cs()
    second_highest_cs_flag, second_highest_cs_report = second_highest_cs()

    if mw_flag == "high_error":
        mw_feedback = "The difference between the model MW ("+str(m_mw)+") and the SAXS MW ("+str(e_mw)+") is large ("+ str(round(100*mw_err,1),2) + "%), sequence or oligomerization state is likely incorrect."
        overall_chi_square_feedback = "The overall chi-square of this fit is " + str(round(overall_chi_square,2)) + ". Relook at sequence or oligomerization state."
        highest_chi_square_feedback = "Please revisit sequence and oligomerization state before examining flexibility."
    
    else:
       mw_feedback = "The difference between the model MW ("+str(m_mw)+") and the SAXS MW ("+str(e_mw)+") is "+ str(round(100*mw_err,1)) + "%, within acceptable error (< " + str(round(100*mw_err_cutoff,1))+ "%)"
       
       if overall_cs_flag == "excellent_cs":
           overall_chi_square_feedback = "The overall chi-square of this fit is " + str(round(overall_chi_square,2)) +". Excellent."
           all_good_flag = region_check()
           if all_good_flag == "all_good":
               highest_chi_square_feedback = "The model has a low chi-square thoughout all q-ranges and is good fit overall."
           else:
                if highest_cs_flag == "low_q_err":
                    highest_chi_square_feedback = "Overall fit is good, but some error may come from detector artifacts or oligomerization states in the sample."
                elif highest_cs_flag == "mid_q_err":
                    highest_chi_square_feedback = "Overall fit is good, but flexibility of elongated regions could be improved a bit. You can try to increase flexibility and see if that helps."
                elif highest_cs_flag == "high_q_err":
                    highest_chi_square_feedback = "Overall fit is good, though there may be a small amount of error in the buffer subtraction."
                    high_noise_flag = high_q_noise()
                    if high_noise_flag == "high_noise":
                        highest_chi_square_feedback = highest_chi_square_feedback +  " Additionally, chi-square in the high-q region (" +  round(q_ranges[-2],2) + " < q < " + q_ranges[-1] + ") is very low (" + round(chi_squares_of_regions[-1]) + "). Though the model fits well, the data are very noisy"
                else:
                    highest_chi_square_feedback = "No other adjustments can improve this fit further."
       
       elif overall_cs_flag == "moderate_cs":
           overall_chi_square_feedback = "The overall chi-square of this fit is " + str(round(overall_chi_square,2)) +". Moderate. You are getting there, so let's try to improve it."
           if highest_cs_flag == "low_q_err":
               highest_chi_square_feedback = "The overall structure of the pdb model needs improvement. This may come from a sequence that is off, or the presence of oligomerization states in the sample"
               if second_highest_cs_flag == "mid_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " Flexibility of elongated regions must also be increased. Try adjusting the flexible regions in the const.inp file."  
               elif second_highest_cs_flag == "high_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " Buffer subtraction problems may have also occured."          
           elif highest_cs_flag == "mid_q_err":
               highest_chi_square_feedback = "Flexibility of elongated regions must be increased, but you are close to a good fit. Try adjusting the flexible regions in the const.inp file."
               if second_highest_cs_flag == "low_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The sequence and oligomerization states are also not a good fit and should be revisited."
               elif second_highest_cs_flag == "high_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " Buffer subtraction problems may have also occured."                
           elif highest_cs_flag == "high_q_err":
               highest_chi_square_feedback = "There are likely problems with buffer subtraction. Try re-analyzing the SAXS and scaling the buffer intensity."
               if second_highest_cs_flag == "low_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The sequence and oligomerization states should also be revisited."
               elif second_highest_cs_flag == "mid_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " Flexibility of elongated regions must also be increased. Try adjusting the flexible regions in the const.inp file."  
           else:
               highest_chi_square_feedback = "Something is wrong. The overall chi-square is > 2, but all q-regions have chi-square < 2? Please revisit fit."

       elif overall_cs_flag == "bad_cs":
           overall_chi_square_feedback = "The overall chi-square of this fit is " + str(round(overall_chi_square,2)) +". Poor."
           if highest_cs_flag == "low_q_err":
               highest_chi_square_feedback = "Between the model and experiment, there is likely a large difference in sequence, oligomerization, etc."
               if second_highest_cs_flag == "mid_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The movement of flexible regions in the model also do not seem to improve the fitting"
               elif second_highest_cs_flag == "high_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " There are also background subtraction problems."     
           elif highest_cs_flag == "mid_q_err":
               highest_chi_square_feedback = "The flexible regions in the model cannot find a fit with the SAXS. Try adjusting the flexible regions in the const.inp file."
               if second_highest_cs_flag == "low_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The overall structure and oligomerization states are also likely wrong."
               elif second_highest_cs_flag == "high_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " There are also background subtraction problems."    
           elif highest_cs_flag == "high_q_err":
               highest_chi_square_feedback = "Buffer subtraction is incorrect."
               if second_highest_cs_flag == "low_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The overall structure and oligomerization states are also likely wrong."
               elif second_highest_cs_flag == "mid_q_err":
                   highest_chi_square_feedback = highest_chi_square_feedback + " The movement of flexible regions in the model also do not seem to improve the fitting"    
           else:
               highest_chi_square_feedback = "Something is wrong. The overall chi-square is > 2, but all q-regions have chi-square < 2? Please revisit fit." 
       else:
           overall_chi_square_feedback = "Could not retrieve overall chi-square. Something is wrong."
           highest_chi_square_feedback = "Could not retrieve overall chi-square. Something is wrong."
    
    print_debug("\n" + mw_feedback)
    print_debug("\n" + overall_chi_square_feedback)
    print_debug("\n" + highest_chi_square_feedback)
    print_debug("\n")


    chi_squares_of_regions_rounded = [round(cs,2) for cs in chi_squares_of_regions]
    residuals_of_regions_rounded = [round(res,3) for res in residuals_of_regions]
    
    output_dict = {
        "mw_saxs": round(e_mw,2), 
        "mw_model": round(m_mw,2), 
        "mw_err": round(mw_err,1), 
        "overall_chi_square": round(overall_chi_square,2),
        "q_ranges": q_ranges,
        "chi_squares_of_regions": chi_squares_of_regions_rounded, 
        "residuals_of_regions": residuals_of_regions_rounded, 
        "mw_feedback": mw_feedback, 
        "overall_chi_square_feedback": overall_chi_square_feedback, 
        "highest_chi_square_report": highest_chi_square_report,
        "second_highest_cs_report": second_highest_cs_report,
        "highest_chi_square_feedback": highest_chi_square_feedback
        }
    json_output = json.dumps(output_dict, indent=4)
    print(json_output)

start_tree()